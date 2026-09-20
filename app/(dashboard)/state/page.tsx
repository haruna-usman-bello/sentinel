import Link from "next/link";

import { FlagsTable } from "@/components/dashboard/flags-table";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Grid2, Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { Button } from "@/components/ui/button";
import { isOpen, monthLabel } from "@/lib/domain";
import { listLgas } from "@/lib/queries/facilities";
import { confirmedOutbreaks, listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

export default async function StateDashboardPage(props: PageProps<"/state">) {
  const { role, scope } = await viewer();
  if (role.key !== "state") return <RoleGate allow={["state"]} />;

  const stateName = scope.state!;
  const { period } = await resolvePeriod((await props.searchParams).period);
  const [flags, confirmed, lgas] = await Promise.all([
    listFlags(scope, period),
    confirmedOutbreaks(scope, period),
    listLgas(stateName),
  ]);

  const peak = Math.max(1, ...lgas.map((lga) => flags.filter((f) => f.lga === lga).length));
  const silent = flags.filter((f) => f.type === "non_reporting").length;

  return (
    <>
      <PageHeader
        title={`${stateName} State dashboard`}
        periodScoped
        actions={
          <Button asChild variant="outline">
            <Link href="/export">Export situation report</Link>
          </Button>
        }
      />
      <PageBody>

        <DenialNotice />

        <StatStrip
          items={[
            { value: flags.length, label: "Flags shown" },
            {
              value: flags.filter((f) => f.status === "pending").length,
              label: "Awaiting triage",
              tone: "warning",
            },
            {
              value: flags.filter((f) => f.status === "confirmed").length,
              label: "Confirmed",
              tone: "critical",
            },
            { value: silent, label: "Facilities not reporting" },
            {
              value: `${Math.round((1 - silent / 20) * 100)}%`,
              label: "Reporting completeness",
              tone: "success",
            },
          ]}
        />

        <Grid2>
          <Panel>
            <PanelHeader
              title="Flags by LGA"
              description="Red where at least one flag is still open."
            />
            <PanelBody>
              {lgas.map((lga) => {
                const rows = flags.filter((f) => f.lga === lga);
                const open = rows.filter(isOpen).length;
                return (
                  <div
                    key={lga}
                    className="grid grid-cols-[100px_1fr_auto] items-center gap-3 py-[7px]"
                  >
                    <Link
                      href={`/flags?lga=${encodeURIComponent(lga)}`}
                      className="text-brand truncate text-left text-[0.85rem] hover:underline"
                    >
                      {lga}
                    </Link>
                    <div className="bg-secondary h-[19px] overflow-hidden rounded-sm">
                      <div
                        className={open ? "bg-critical/80 h-full" : "bg-success/80 h-full"}
                        style={{ width: `${Math.round((rows.length / peak) * 100)}%` }}
                      />
                    </div>
                    <span className="tnum text-muted-foreground font-mono text-[0.78rem] whitespace-nowrap">
                      {rows.length} ({open} open)
                    </span>
                  </div>
                );
              })}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Confirmed outbreaks"
              description="Most recent first, including those since closed."
            />
            <PanelBody>
              {confirmed.length === 0 ? (
                <p className="text-muted-foreground m-0 text-[0.83rem]">
                  No outbreak has been confirmed in the state up to this period.
                </p>
              ) : (
                <ul className="m-0 flex list-disc flex-col gap-[9px] pl-[18px] text-[0.87rem]">
                  {confirmed.map(({ flag, closedOn, note }) => (
                    <li key={flag.id}>
                      <Link
                        href={`/flags/${flag.id}`}
                        className="font-semibold hover:underline"
                      >
                        {flag.disease} — {flag.facilityName}
                      </Link>
                      , {monthLabel(flag.period)}.
                      {closedOn ? ` Closed ${closedOn}.` : ""}
                      {note ? ` ${note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </Grid2>

        <Panel>
          <PanelHeader
            title="Open flags across the state"
            description="Ordered by signal strength."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/flags">See all {flags.length} flags</Link>
              </Button>
            }
          />
          <FlagsTable
            flags={[...flags].filter(isOpen).sort((a, b) => (b.z ?? 2.9) - (a.z ?? 2.9))}
            empty="Nothing open in the state this period."
          />
        </Panel>
      </PageBody>
    </>
  );
}
