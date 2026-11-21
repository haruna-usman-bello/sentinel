import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Status, Tag } from "@/components/dashboard/badges";
import { DenialNotice } from "@/components/dashboard/notices";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { SectionHeading } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { monthLong, stateRollup } from "@/lib/domain";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { monthReporting } from "@/lib/queries/system";

/** The 36 states and the Federal Capital Territory. */
const TOTAL_STATES = 37;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function NationalPage(props: PageProps<"/national">) {
  const { role, scope } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const [flags, reporting] = await Promise.all([listFlags(scope, period), monthReporting(scope, period)]);
  const month = monthLong(period);

  const missingByState = new Map<string, number>();
  for (const report of reporting.missing) {
    missingByState.set(report.state, (missingByState.get(report.state) ?? 0) + 1);
  }
  const rollup = stateRollup(flags);
  // A state needs the national desk when something is open or confirmed there,
  // or when a report it owed this month did not come.
  const states = [
    ...rollup.map((row) => ({ ...row, missing: missingByState.get(row.state) ?? 0 })),
    ...[...missingByState]
      .filter(([state]) => !rollup.some((row) => row.state === state))
      .map(([state, missing]) => ({ state, total: 0, open: 0, confirmed: 0, silent: 0, diseases: [], missing })),
  ]
    .filter((row) => row.open || row.confirmed || row.missing)
    .sort((a, b) => b.confirmed - a.confirmed || b.open - a.open || b.missing - a.missing);

  const open = states.reduce((sum, row) => sum + row.open, 0);
  const confirmed = states.reduce((sum, row) => sum + row.confirmed, 0);
  const statesOpen = states.filter((row) => row.open).length;

  return (
    <>
      <PageHeader title="National summary" periodScoped />
      <PageBody>
        <DenialNotice />

        <Lead>
          {open ? (
            <strong>
              {plural(open, "flag is", "flags are")} open in {plural(statesOpen, "state", "states")}.
            </strong>
          ) : (
            <strong>No flag is open anywhere.</strong>
          )}{" "}
          {confirmed
            ? `${plural(confirmed, "confirmed outbreak is", "confirmed outbreaks are")} still being responded to. `
            : ""}
          {reporting.expected
            ? `${reporting.received} of ${reporting.expected} expected reports arrived for ${month}${
                reporting.facilitiesMissing
                  ? `, with ${plural(reporting.facilitiesMissing, "facility", "facilities")} missing at least one.`
                  : "."
              }`
            : `No reports were due yet for ${month}.`}
        </Lead>

        <section className="flex flex-col gap-2.5">
          <SectionHeading
            title="States that need attention"
            count={states.length}
            hint="Confirmed outbreaks first, then the most open flags."
          />
          {states.length ? (
            <ul className="@container m-0 list-none border-t p-0">
              {states.map((row) => (
                <li key={row.state} className="border-line-soft border-b">
                  <Link
                    href={`/flags?state=${encodeURIComponent(row.state)}`}
                    className="group/row hover:bg-secondary/60 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md px-1 py-3.5 @xl:grid-cols-[minmax(0,1fr)_9rem_auto]"
                  >
                    <span className="col-start-1 row-start-1 flex min-w-0 flex-col gap-0.5">
                      <span className="text-[0.95rem] font-semibold">{row.state}</span>
                      <span className="text-muted-foreground text-[0.84rem]">
                        {[
                          row.open ? `${row.open} open` : null,
                          row.confirmed ? `${row.confirmed} confirmed` : null,
                          row.missing ? plural(row.missing, "missing report", "missing reports") : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      {row.diseases.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {row.diseases.map((d) => (
                            <Tag key={d}>{d}</Tag>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className="col-start-1 row-start-2 @xl:col-start-2 @xl:row-start-1">
                      {row.confirmed ? (
                        <Status tone="critical">Outbreak</Status>
                      ) : row.open ? (
                        <Status tone="warning">Watch</Status>
                      ) : (
                        <Status tone="warning">Missing reports</Status>
                      )}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="text-faint group-hover/row:text-foreground col-start-2 row-span-2 row-start-1 size-4 transition-transform duration-150 group-hover/row:translate-x-0.5 motion-reduce:transition-none @xl:col-start-3 @xl:row-span-1"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground text-[0.88rem]">
            {states.length
              ? `The other ${TOTAL_STATES - states.length} of the 36 states and the FCT have nothing open and no missing reports for ${month}.`
              : `All 36 states and the FCT have nothing open and no missing reports for ${month}.`}
          </p>
        </section>
      </PageBody>
    </>
  );
}
