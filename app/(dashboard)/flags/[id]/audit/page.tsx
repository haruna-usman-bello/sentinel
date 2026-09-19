"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { StatusPill } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { FACILITY_BY_CODE, LAST_DETECTION_RUN } from "@/lib/data";
import { monthLabel } from "@/lib/domain";
import type { FlagLogEntry } from "@/lib/types";

export default function AuditTrailPage() {
  const params = useParams<{ id: string }>();
  const { flags, flagLogs, role } = useDashboard();

  const flag = flags.find((f) => f.id === Number(params.id));

  if (!flag) {
    return (
      <>
        <PageHeader title="Flag not found" />
        <PageBody>
          <p className="text-muted-foreground text-[0.85rem]">
            No flag with that identifier is visible to your role.
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href={role.home}>Back to your dashboard</Link>
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  const facility = FACILITY_BY_CODE[flag.facility];

  const raised: FlagLogEntry = {
    flag: flag.id,
    at: LAST_DETECTION_RUN,
    actor: "Detection engine",
    from: null,
    to: "pending",
    note:
      flag.type === "statistical"
        ? `${flag.cases} cases reported — ${flag.z?.toFixed(2)}× the usual variation, above the ${flag.k?.toFixed(1)}× alert level for ${flag.disease}.`
        : `No case count received for ${monthLabel(flag.period)}, after an unbroken reporting history.`,
  };

  const entries = [raised, ...flagLogs.filter((l) => l.flag === flag.id)];

  return (
    <>
      <PageHeader
        title="Audit trail"
        actions={
          <Button asChild variant="outline">
            <Link href={`/flags/${flag.id}`}>Back to case trend</Link>
          </Button>
        }
      />
      <PageBody>

        <Panel>
          <PanelHeader
            title={`${facility.name} — ${flag.disease}, ${monthLabel(flag.period)}`}
            description={
              <>
                {flag.lga} LGA, {flag.state} State · currently{" "}
                <StatusPill status={flag.status} />
              </>
            }
          />
          <PanelBody>
            <ol className="border-border m-0 flex list-none flex-col gap-4 border-l-2 py-1 pl-5">
              {entries.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="relative">
                  <span
                    aria-hidden
                    className={`bg-card absolute top-[5px] -left-[27px] size-[11px] rounded-full border-2 ${
                      i === 0 ? "border-warning" : "border-brand"
                    }`}
                  />
                  <div className="text-faint font-mono text-[0.68rem]">{entry.at}</div>
                  <div className="mt-[2px] text-[0.88rem]">
                    <strong className="font-semibold">{entry.actor}</strong>{" "}
                    {entry.from === null ? (
                      "raised the flag"
                    ) : (
                      <>
                        moved it from <StatusPill status={entry.from} /> to{" "}
                        <StatusPill status={entry.to} />
                      </>
                    )}
                  </div>
                  {entry.note ? (
                    <div className="bg-secondary border-border text-muted-foreground mt-[5px] rounded-r-sm border-l-2 px-[10px] py-[7px] text-[0.82rem]">
                      {entry.note}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
