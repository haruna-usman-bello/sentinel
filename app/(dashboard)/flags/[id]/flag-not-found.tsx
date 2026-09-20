import Link from "next/link";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

/** Shown for an id that does not exist or lies outside the caller's scope — the two are not distinguished. */
export function FlagNotFound({ home }: { home: string }) {
  return (
    <>
      <PageHeader title="Flag not found" />
      <PageBody>
        <p className="text-muted-foreground text-[0.85rem]">
          No flag with that identifier is visible to your role.
        </p>
        <div>
          <Button asChild variant="outline">
            <Link href={home}>Back to your dashboard</Link>
          </Button>
        </div>
      </PageBody>
    </>
  );
}
