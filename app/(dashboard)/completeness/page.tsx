import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { TonePill } from "@/components/dashboard/badges";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure, SectionHeading } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { monthLabel, monthLong } from "@/lib/domain";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { listCompleteness, monthReporting, type MissingReport } from "@/lib/queries/system";
import type { Role } from "@/lib/types";

/** Where a missing report is, said only as far as the reader's own patch needs. */
function placeOf(report: Pick<MissingReport, "lga" | "state">, role: Role): string | null {
  if (role === "national") return `${report.lga} LGA, ${report.state}`;
  if (role === "state") return `${report.lga} LGA`;
  return null;
}

export default async function CompletenessPage(props: PageProps<"/completeness">) {
  const { role, scope } = await viewer();
  if (role.key !== "supervisor" && role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["supervisor", "state", "national"]} />;
  }

  const { period, periods } = await resolvePeriod((await props.searchParams).period);
  const [reporting, records] = await Promise.all([monthReporting(scope, period), listCompleteness(scope)]);
  const month = monthLong(period);
  const months = periods.length;

  const expected = records.reduce((sum, r) => sum + r.expected, 0);
  const received = records.reduce((sum, r) => sum + r.received, 0);
  const percent = expected ? Math.round((received / expected) * 100) : null;
  // What needs following up comes first: the longest silent at the top.
  const rows = [...records].sort(
    (a, b) => b.silentMonths - a.silentMonths || a.facilityName.localeCompare(b.facilityName),
  );
  const latest = periods.at(-1);
  const missing = reporting.missing.length;

  return (
    <>
      <PageHeader title="Reporting" periodScoped />
      <PageBody>
        <div className="flex flex-col gap-2">
          <Lead>
            {reporting.expected ? (
              missing ? (
                <>
                  <strong>
                    {reporting.received} of the {reporting.expected} reports expected for {month} arrived.
                  </strong>{" "}
                  {missing === 1
                    ? "One is missing."
                    : `${missing} are missing, from ${reporting.facilitiesMissing} ${reporting.facilitiesMissing === 1 ? "facility" : "facilities"}.`}
                </>
              ) : (
                <strong>
                  All {reporting.expected} reports expected for {month} arrived.
                </strong>
              )
            ) : (
              <strong>No reports were due yet for {month}.</strong>
            )}
          </Lead>
          <p className="text-muted-foreground max-w-[68ch] text-[0.88rem]">
            A facility is expected to report a disease once it has reported it three months
            running. One that has never reported is a question for the register, not a silence.
          </p>
        </div>

        {reporting.expected ? (
          <section className="flex flex-col gap-2.5">
            <SectionHeading title={`Missing for ${month}`} count={missing} />
            {missing ? (
              <ul className="m-0 list-none border-t p-0">
                {reporting.missing.map((report) => {
                  const where = placeOf(report, role.key);
                  const body = (
                    <>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[0.95rem] font-semibold">
                          {report.disease} at {report.facilityName}
                        </span>
                        <span className="text-muted-foreground text-[0.84rem]">
                          {[where, report.flagId ? "No-report flag raised" : "Not yet checked by the detector"]
                            .filter(Boolean)
                            .join(". ")}
                        </span>
                      </span>
                      {report.flagId ? (
                        <ChevronRight
                          aria-hidden
                          className="text-faint group-hover/row:text-foreground size-4 shrink-0 transition-transform duration-150 group-hover/row:translate-x-0.5 motion-reduce:transition-none"
                        />
                      ) : null}
                    </>
                  );
                  return (
                    <li key={`${report.facility}/${report.disease}`} className="border-line-soft border-b">
                      {report.flagId ? (
                        <Link
                          href={`/flags/${report.flagId}`}
                          className="group/row hover:bg-secondary/60 flex items-center justify-between gap-4 rounded-md px-1 py-3"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-4 px-1 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground border-t py-3 text-[0.9rem]">
                Every facility that usually reports did so for {month}.
              </p>
            )}
          </section>
        ) : null}

        <Disclosure
          title="Every facility's record"
          count={rows.length}
          note={percent === null ? undefined : `${percent}% of reports received over ${months} ${months === 1 ? "month" : "months"}`}
        >
          {rows.length ? (
            <ul className="@container m-0 list-none border-t p-0">
              {rows.map((row) => {
                const pct = Math.round((row.received / row.expected) * 100);
                return (
                  <li
                    key={row.facility}
                    className="border-line-soft grid grid-cols-1 gap-x-6 gap-y-1.5 border-b px-1 py-3 @xl:grid-cols-[minmax(0,1fr)_11rem_10rem] @xl:items-center"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[0.93rem] font-semibold">{row.facilityName}</span>
                      <span className="text-muted-foreground text-[0.84rem]">
                        {row.lga} LGA, last report {monthLabel(row.lastPeriod)}
                      </span>
                    </span>
                    <span>
                      {row.silentMonths ? (
                        <TonePill tone={row.silentMonths >= 2 ? "critical" : "warning"}>
                          {row.silentMonths === 1 && latest
                            ? `Sent nothing for ${monthLabel(latest)}`
                            : `Sent nothing for ${row.silentMonths} months`}
                        </TonePill>
                      ) : (
                        <TonePill tone="success">Reporting</TonePill>
                      )}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-[0.84rem]">
                        {row.received} of {row.expected} received
                      </span>
                      <span className="bg-secondary block h-1.5 max-w-40 overflow-hidden rounded-full">
                        <span
                          className={pct >= 95 ? "bg-success block h-full" : pct >= 88 ? "bg-brand block h-full" : "bg-warning block h-full"}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-[0.9rem]">No facility has reported yet.</p>
          )}
        </Disclosure>
      </PageBody>
    </>
  );
}
