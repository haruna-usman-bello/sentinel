"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { FlagsTable } from "@/components/dashboard/flags-table";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Grid2, Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { Button } from "@/components/ui/button";
import { FACILITIES, FACILITY_BY_CODE } from "@/lib/data";
import { isOpen, monthLabel } from "@/lib/domain";

export default function StateDashboardPage() {
  return (
    <RoleGate allow={["state"]}>
      <StateDashboard />
    </RoleGate>
  );
}

function StateDashboard() {
  const { scopedFlags, flagLogs, role } = useDashboard();
  const router = useRouter();

  const stateName = role.scope.state!;

  // Everything that has been declared an outbreak, including flags since closed.
  const confirmed = scopedFlags
    .filter(
      (f) =>
        f.status === "confirmed" ||
        (f.status === "closed" &&
          flagLogs.some((l) => l.flag === f.id && l.to === "confirmed")),
    )
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 5)
    .map((flag) => {
      const logs = flagLogs.filter((l) => l.flag === flag.id);
      const closed = logs.find((l) => l.to === "closed");
      const note =
        logs.find((l) => l.to === "confirmed")?.note || closed?.note || "";
      return { flag, closed, note };
    });
  const lgas = [
    ...new Set(FACILITIES.filter((f) => f.state === stateName).map((f) => f.lga)),
  ];
  const peak = Math.max(
    1,
    ...lgas.map((lga) => scopedFlags.filter((f) => f.lga === lga).length),
  );

  const silent = scopedFlags.filter((f) => f.type === "non_reporting").length;

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
            { value: scopedFlags.length, label: "Flags shown" },
            {
              value: scopedFlags.filter((f) => f.status === "pending").length,
              label: "Awaiting triage",
              tone: "warning",
            },
            {
              value: scopedFlags.filter((f) => f.status === "confirmed").length,
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
                const rows = scopedFlags.filter((f) => f.lga === lga);
                const open = rows.filter(isOpen).length;
                return (
                  <div
                    key={lga}
                    className="grid grid-cols-[100px_1fr_auto] items-center gap-3 py-[7px]"
                  >
                    <button
                      type="button"
                      className="text-brand truncate text-left text-[0.85rem] hover:underline"
                      onClick={() =>
                        router.push(`/flags?lga=${encodeURIComponent(lga)}`)
                      }
                    >
                      {lga}
                    </button>
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
                  {confirmed.map(({ flag, closed, note }) => (
                    <li key={flag.id}>
                      <Link
                        href={`/flags/${flag.id}`}
                        className="font-semibold hover:underline"
                      >
                        {flag.disease} — {FACILITY_BY_CODE[flag.facility].name}
                      </Link>
                      , {monthLabel(flag.period)}.
                      {closed ? ` Closed ${closed.at.slice(0, 10)}.` : ""}
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
                <Link href="/flags">See all {scopedFlags.length} flags</Link>
              </Button>
            }
          />
          <FlagsTable
            flags={[...scopedFlags]
              .filter(isOpen)
              .sort((a, b) => (b.z ?? 2.9) - (a.z ?? 2.9))}
            empty="Nothing open in the state this period."
          />
        </Panel>
      </PageBody>
    </>
  );
}
