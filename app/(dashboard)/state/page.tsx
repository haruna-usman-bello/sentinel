import Link from "next/link";

import { FlagGroup, FlagRow, FoldedFlagGroup } from "@/components/dashboard/flag-list";
import { DenialNotice } from "@/components/dashboard/notices";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { isOpen, monthLabel, monthLong, shortDate } from "@/lib/domain";
import { listLgas } from "@/lib/queries/facilities";
import { confirmedOutbreaks, flagTrails, listFlags, withUsualLevels } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { monthReporting } from "@/lib/queries/system";
import type { Flag } from "@/lib/types";

/** Strongest signal first; a missing report ranks with a strong rise. */
const byStrength = (a: Flag, b: Flag) => (b.z ?? 2.9) - (a.z ?? 2.9);

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function StateDashboardPage(props: PageProps<"/state">) {
  const { role, scope } = await viewer();
  if (role.key !== "state") return <RoleGate allow={["state"]} />;

  const stateName = scope.state!;
  const { period, current } = await resolvePeriod((await props.searchParams).period);
  const [listed, outbreaks, lgas, reporting] = await Promise.all([
    listFlags(scope, period),
    confirmedOutbreaks(scope, period, null),
    listLgas(stateName),
    monthReporting(scope, period),
  ]);
  const [flags, trails] = await Promise.all([
    withUsualLevels(listed),
    flagTrails(listed.filter((f) => f.status === "investigating")),
  ]);

  const notOpened = flags.filter((f) => f.status === "pending").sort(byStrength);
  const investigating = flags.filter((f) => f.status === "investigating").sort(byStrength);
  const confirmed = flags.filter((f) => f.status === "confirmed");
  const decided = flags.filter((f) => f.status === "false_alarm" || f.status === "closed");
  const open = notOpened.length + investigating.length;

  const where = `${stateName}'s ${plural(lgas.length, "LGA", "LGAs")}`;
  const month = monthLong(period);

  return (
    <>
      <PageHeader title={`${stateName} State`} periodScoped />
      <PageBody>
        <DenialNotice />

        <Lead>
          {open ? (
            <>
              <strong>
                {plural(open, "flag is", "flags are")} open across {where}.
              </strong>{" "}
              {notOpened.length && investigating.length
                ? `Officers haven't opened ${notOpened.length} of them yet, and ${investigating.length} ${investigating.length === 1 ? "is" : "are"} under investigation.`
                : notOpened.length
                  ? "Officers haven't opened any of them yet."
                  : "All of them are under investigation."}{" "}
            </>
          ) : (
            <>
              <strong>Nothing is open across {where}.</strong>{" "}
            </>
          )}
          {reporting.expected
            ? `${reporting.received} of ${reporting.expected} expected reports arrived for ${month}.`
            : `No reports were due yet for ${month}.`}
        </Lead>

        <div className="grid items-start gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <FlagGroup
              title="Not opened yet"
              hint="Waiting for the LGA officer. Strongest signal first."
              count={notOpened.length}
              empty="Officers have opened every flag."
            >
              {notOpened.map((flag) => (
                <FlagRow key={flag.id} flag={flag} />
              ))}
            </FlagGroup>

            <FlagGroup
              title="Under investigation"
              hint="The LGA supervisor decides once the officer has reported back."
              count={investigating.length}
              empty="Nothing is under investigation."
            >
              {investigating.map((flag) => {
                const finding = trails.get(flag.id)?.lastFinding;
                return (
                  <FlagRow
                    key={flag.id}
                    flag={flag}
                    note={
                      finding ? (
                        <span className="line-clamp-2">
                          Last finding, {shortDate(finding.at)}: {finding.note}
                        </span>
                      ) : (
                        "No findings yet."
                      )
                    }
                  />
                );
              })}
            </FlagGroup>

            <div>
              <FoldedFlagGroup
                title="Confirmed, waiting to be closed"
                count={confirmed.length}
                empty="No outbreak is open."
              >
                {confirmed.map((flag) => (
                  <FlagRow key={flag.id} flag={flag} />
                ))}
              </FoldedFlagGroup>
              <FoldedFlagGroup
                title="Decided"
                count={decided.length}
                note="Closed or dismissed"
                empty="Nothing has been closed or dismissed yet."
              >
                {decided.map((flag) => (
                  <FlagRow key={flag.id} flag={flag} showStatus />
                ))}
              </FoldedFlagGroup>
            </div>
          </div>

          <aside className="flex flex-col gap-6" aria-label={`${stateName} at a glance`}>
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[0.95rem] font-semibold">Open flags by LGA</h2>
              {lgas.length ? (
                <ul className="m-0 list-none border-t p-0">
                  {lgas.map((lga) => {
                    const count = flags.filter((f) => f.lga === lga && isOpen(f)).length;
                    return (
                      <li key={lga} className="border-line-soft border-b">
                        <Link
                          href={`/flags?lga=${encodeURIComponent(lga)}`}
                          className="hover:bg-secondary/60 flex items-center justify-between gap-3 rounded-md px-1 py-2 text-[0.9rem]"
                        >
                          <span className="truncate">{lga}</span>
                          <span className={count ? "text-critical font-semibold" : "text-faint"}>
                            {count || "None"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground text-[0.88rem]">
                  No facility in {stateName} is on the register yet.
                </p>
              )}
              <Link href="/map" className="text-brand mt-1 self-start text-[0.9rem] font-medium hover:underline hover:underline-offset-[3px]">
                Open the map
              </Link>
            </section>

            {reporting.missing.length ? (
              <section className="flex flex-col gap-1.5">
                <h2 className="text-[0.95rem] font-semibold">Missing for {monthLabel(period)}</h2>
                <p className="text-muted-foreground text-[0.86rem]">
                  {plural(reporting.facilitiesMissing, "facility", "facilities")} sent no report for{" "}
                  {reporting.missing.length === 1 ? "a disease" : "a disease or more"} they usually report.
                </p>
                <Link
                  href={period === current ? "/completeness" : `/completeness?period=${period}`}
                  className="text-brand self-start text-[0.9rem] font-medium hover:underline hover:underline-offset-[3px]"
                >
                  See who
                </Link>
              </section>
            ) : null}

            <Disclosure title="Confirmed outbreaks" count={outbreaks.length}>
              {outbreaks.length ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[0.88rem]">
                  {outbreaks.map(({ flag, closedOn, note }) => (
                    <li key={flag.id} className="flex flex-col gap-0.5">
                      <Link href={`/flags/${flag.id}`} className="font-semibold hover:underline hover:underline-offset-[3px]">
                        {flag.disease} at {flag.facilityName}
                      </Link>
                      <span className="text-muted-foreground">
                        {monthLabel(flag.period)}
                        {closedOn ? `, closed ${shortDate(`${closedOn} 00:00`)}` : ", still open"}.
                        {note ? ` ${note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-[0.88rem]">
                  No outbreak has been confirmed in {stateName} up to {month}.
                </p>
              )}
            </Disclosure>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
