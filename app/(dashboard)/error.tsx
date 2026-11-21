"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

/**
 * Shown when a screen fails to build — most often because the database is
 * unreachable. It says which, because "something went wrong" tells a
 * surveillance officer nothing about whether to wait or call someone, and it
 * offers to try again without losing the session.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard screen failed:", error);
  }, [error]);

  return (
    <>
      <PageHeader title="This screen could not be loaded" />
      <PageBody>
        <div role="alert" className="bg-critical-soft max-w-[68ch] rounded-lg px-4 py-3 text-[0.92rem]">
          <strong className="font-semibold">Nothing is shown rather than something partial.</strong>{" "}
          No flag or decision has been changed. This is usually the database being briefly
          unreachable, so trying again often works. If it keeps happening, tell the system
          administrator.
          {error.digest ? (
            <div className="text-muted-foreground mt-2 text-[0.84rem]">
              Reference {error.digest}. Quote it when you report this.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back to your dashboard</Link>
          </Button>
        </div>
      </PageBody>
    </>
  );
}
