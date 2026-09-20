import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { formatStamp, monthLong } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/lib/queries/periods";
import { ROLES, isRole } from "@/lib/roles";
import { currentSession } from "@/lib/session";

import { type DemoAccount, SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** The first active account of each tier — the development picker's entries. */
async function demoAccounts(): Promise<DemoAccount[]> {
  const rows = await prisma.user.findMany({
    where: { active: true },
    select: { name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  return Object.keys(ROLES)
    .map((role) => rows.find((r) => r.role === role))
    .filter((r): r is NonNullable<typeof r> => !!r && isRole(r.role))
    .map((r) => ({ name: r.name, email: r.email, role: r.role }));
}

export default async function SignInPage() {
  const session = await currentSession();
  if (session) redirect(session.role.home);

  const [period, lastRun, picker] = await Promise.all([
    currentPeriod(),
    prisma.ingestRun.findFirst({ orderBy: { at: "desc" }, select: { at: true } }),
    process.env.NODE_ENV === "production" ? null : demoAccounts(),
  ]);

  return (
    <main className="mx-auto flex max-w-[940px] flex-col gap-[26px] px-6 pt-12 pb-[70px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.9rem] font-semibold">Sentinel</h1>
          <p className="text-muted-foreground mt-[10px] max-w-[60ch]">
            Early detection of unusual disease case patterns in DHIS2 aggregate
            reporting.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <SignInForm demoAccounts={picker} />

      <p className="text-faint m-0 font-mono text-[0.7rem]">
        Reporting period {monthLong(period)}
        {lastRun ? ` · detection last run ${formatStamp(lastRun.at)}` : ""}
      </p>
    </main>
  );
}
