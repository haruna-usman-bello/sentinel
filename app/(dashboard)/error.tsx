"use client";

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
        <div
          role="alert"
          className="bg-critical-soft border-critical/40 flex items-start gap-[11px] rounded-md border px-[15px] py-[13px]"
        >
          <span className="bg-critical mt-px shrink-0 rounded-[3px] px-[7px] py-[2px] font-mono text-[0.65rem] font-semibold text-white">
            Error
          </span>
          <div className="text-[0.85rem]">
            <strong className="font-semibold">
              The screen could not be built, so nothing is shown rather than something
              partial.
            </strong>
            <br />
            No flag or decision has been changed. This is usually the database being
            briefly unreachable; trying again often works. If it keeps happening, the
            system administrator should be told.
            {error.digest ? (
              <div className="text-muted-foreground mt-2 font-mono text-[0.72rem]">
                Reference {error.digest} — quote this when reporting it.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <a href="/">Back to your dashboard</a>
          </Button>
        </div>
      </PageBody>
    </>
  );
}
