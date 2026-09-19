import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { CURRENT_PERIOD } from "@/lib/data";
import { monthLong } from "@/lib/domain";
import { currentRole } from "@/lib/session";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const role = await currentRole();
  if (role) redirect(role.home);

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

      <SignInForm />

      <p className="text-faint m-0 font-mono text-[0.7rem]">
        Reporting period {monthLong(CURRENT_PERIOD)} · detection last run 5 August 2026,
        06:02
      </p>
    </main>
  );
}
