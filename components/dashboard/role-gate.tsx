"use client";

import Link from "next/link";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

/**
 * Scope is enforced in the data the page is built from, not by hiding controls.
 * This guard covers the direct-URL case: a role that has no business on a
 * screen is told so plainly rather than shown an empty one. A server page
 * renders it without children once it has decided not to load anything.
 */
export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children?: React.ReactNode;
}) {
  const { role, scopeLabel } = useDashboard();

  if (allow.includes(role.key)) return <>{children}</>;

  return (
    <>
      <PageHeader title="Not available to your role" />
      <PageBody>
        <div role="alert" className="bg-critical-soft max-w-[68ch] rounded-lg px-4 py-3 text-[0.92rem]">
          <strong className="font-semibold">This screen is not part of the {role.label} dashboard.</strong>{" "}
          Your account covers {scopeLabel}. Nothing was loaded: your access is applied to the data
          itself, so there is nothing here to show you.
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
