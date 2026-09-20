import Link from "next/link";

import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import { isOpen, monthLabel } from "@/lib/domain";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import type { Flag } from "@/lib/types";
import { cn } from "@/lib/utils";

function TaskCard({ flag }: { flag: Flag }) {
  const open = isOpen(flag);
  const hot = flag.type === "statistical" && (flag.z ?? 0) >= 3;

  const detail =
    flag.type === "statistical"
      ? `${flag.cases} cases in ${monthLabel(flag.period)} — ${flag.z?.toFixed(1)}× the usual variation, against an alert level of ${flag.k?.toFixed(1)}×`
      : `No case count received for ${monthLabel(flag.period)}, after an unbroken reporting history`;

  return (
    <article
      className={cn(
        "bg-card border-border grid grid-cols-1 items-start gap-[14px] rounded-md border border-l-[3px] px-[17px] py-[15px] sm:grid-cols-[1fr_auto]",
        !open ? "border-l-success opacity-70" : hot ? "border-l-critical" : "border-l-warning",
      )}
    >
      <div>
        <div className="font-heading text-[0.98rem] font-semibold">
          {flag.facilityName} — {flag.disease}
        </div>
        <div className="text-muted-foreground mt-[3px] text-[0.83rem]">{detail}</div>
        <div className="mt-[9px] flex flex-wrap items-center gap-2">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-faint font-mono text-[0.72rem]">
            {flag.facility} · {flag.lga} LGA
          </span>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <FlagDecision flag={flag} variant="card" />
        <Button asChild variant="outline" size="sm">
          <Link href={`/flags/${flag.id}`}>View trend</Link>
        </Button>
      </div>
    </article>
  );
}

export default async function WorklistPage(props: PageProps<"/worklist">) {
  const { role, scope } = await viewer();
  if (role.key !== "officer") return <RoleGate allow={["officer"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const flags = await listFlags(scope, period);

  const open = flags.filter(isOpen);
  const decided = flags.filter((f) => !isOpen(f));

  return (
    <>
      <PageHeader title="My worklist" periodScoped />
      <PageBody>

        <DenialNotice />

        <section>
          <h2 className="text-[1.15rem] font-semibold">
            Needs your attention ({open.length})
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {open.length ? (
              open.map((flag) => <TaskCard key={flag.id} flag={flag} />)
            ) : (
              <p className="text-muted-foreground text-[0.83rem]">
                Nothing open — your LGA is clear this period.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[1.15rem] font-semibold">
            Already decided ({decided.length})
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {decided.length ? (
              decided.map((flag) => <TaskCard key={flag.id} flag={flag} />)
            ) : (
              <p className="text-muted-foreground text-[0.83rem]">No closed flags yet.</p>
            )}
          </div>
        </section>
      </PageBody>
    </>
  );
}
