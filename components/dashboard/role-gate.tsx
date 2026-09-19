"use client";

import Link from "next/link";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

/**
 * Scope is enforced in the data the page is built from, not by hiding controls.
 * This guard covers the direct-URL case: a role that has no business on a
 * screen is told so plainly rather than shown an empty one.
 */
export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { role, scopeLabel } = useDashboard();

  if (allow.includes(role.key)) return <>{children}</>;

  return (
    <>
      <PageHeader title="Not available to your role" />
      <PageBody>
        <div
          role="alert"
          className="bg-critical-soft border-critical/40 flex items-start gap-[11px] rounded-md border px-[15px] py-[13px]"
        >
          <span className="bg-critical mt-px shrink-0 rounded-[3px] px-[7px] py-[2px] font-mono text-[0.65rem] font-semibold text-white">
            Denied
          </span>
          <div className="text-[0.85rem]">
            <strong className="font-semibold">
              This screen is not part of the {role.label} dashboard.
            </strong>
            <br />
            Your account covers {scopeLabel}. Nothing was loaded — the scope is
            applied to the query that builds the page, so there is no data here to show
            you.
          </div>
        </div>
        <div>
          <Button asChild variant="outline">
            <Link href={role.home}>Back to your dashboard</Link>
          </Button>
        </div>
      </PageBody>
    </>
  );
}
