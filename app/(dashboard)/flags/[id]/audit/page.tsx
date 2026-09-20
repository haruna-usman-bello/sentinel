import Link from "next/link";

import { StatusPill } from "@/components/dashboard/badges";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/domain";
import { flagLogs, getFlag } from "@/lib/queries/flags";
import { viewer } from "@/lib/queries/shared";
import type { FlagLogEntry } from "@/lib/types";

import { FlagNotFound } from "../flag-not-found";

export default async function AuditTrailPage(props: PageProps<"/flags/[id]/audit">) {
  const { role, scope } = await viewer();
  const { id } = await props.params;

  const flag = await getFlag(id, scope);
  if (!flag) return <FlagNotFound home={role.home} />;

  const logs = await flagLogs(flag.id);

  // The raise itself is not a log row — it is the flag's own timestamp.
  const raised: FlagLogEntry = {
    id: "raised",
    flag: flag.id,
    at: flag.raisedAt,
    actor: "Detection engine",
    from: null,
    to: "pending",
    note:
      flag.type === "statistical"
        ? `${flag.cases} cases reported — ${flag.z?.toFixed(2)}× the usual variation, above the ${flag.k?.toFixed(1)}× alert level for ${flag.disease}.`
        : `No case count received for ${monthLabel(flag.period)}, after an unbroken reporting history.`,
  };

  const entries = [raised, ...logs];

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
            title={`${flag.facilityName} — ${flag.disease}, ${monthLabel(flag.period)}`}
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
                <li key={entry.id} className="relative">
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
