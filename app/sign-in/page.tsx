import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SentinelMark } from "@/components/dashboard/sentinel-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatStamp, monthLong, stampLabel } from "@/lib/domain";
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
    <main className="bg-sidebar relative flex min-h-svh flex-col items-center px-4 py-14 sm:justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-[24rem] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2.5 text-[1.75rem] font-bold tracking-[-0.02em]">
            <SentinelMark className="text-brand size-7" />
            Sentinel
          </h1>
          <p className="text-muted-foreground">
            Spots unusual rises and missing reports in DHIS2 case counts, so they are followed up
            early.
          </p>
        </div>

        <SignInForm demoAccounts={picker} />

        <p className="text-muted-foreground text-[0.84rem]">
          Latest reporting month: {monthLong(period)}.
          {lastRun ? ` Detection last ran ${stampLabel(formatStamp(lastRun.at))}.` : ""}
        </p>
      </div>
    </main>
  );
}
