"use client";

import { SeverityRule } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMPLETENESS, FACILITY_BY_CODE } from "@/lib/data";
import { monthLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export default function CompletenessPage() {
  return (
    <RoleGate allow={["supervisor", "state", "national"]}>
      <Completeness />
    </RoleGate>
  );
}

function Completeness() {
  const { role } = useDashboard();
  const scope = role.scope;

  const rows = COMPLETENESS.filter((row) => {
    const facility = FACILITY_BY_CODE[row.facility];
    if (scope.state && facility.state !== scope.state) return false;
    if (scope.lga && facility.lga !== scope.lga) return false;
    return true;
  }).sort(
    (a, b) =>
      b.silentMonths - a.silentMonths ||
      a.received / a.expected - b.received / b.expected,
  );

  const expected = rows.reduce((sum, r) => sum + r.expected, 0);
  const received = rows.reduce((sum, r) => sum + r.received, 0);
  const percent = expected ? Math.round((received / expected) * 100) : 100;
  const silent = rows.filter((r) => r.silentMonths > 0);

  return (
    <>
      <PageHeader title="Reporting completeness" periodScoped />
      <PageBody>

        <StatStrip
          items={[
            {
              value: `${percent}%`,
              label: "Completeness, 20 months",
              tone: percent >= 95 ? "success" : "warning",
            },
            { value: rows.length, label: "Reporting facilities" },
            { value: silent.length, label: "Currently silent", tone: "warning" },
            {
              value: rows.filter((r) => r.silentMonths >= 2).length,
              label: "Silent 2+ months",
              tone: "critical",
            },
            { value: expected - received, label: "Reports never received" },
          ]}
        />

        <Panel>
          <PanelHeader
            title="Facility reporting record"
            description="Expected = 2 diseases × 20 monthly reporting periods."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Last report</TableHead>
                  <TableHead>Silent for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const facility = FACILITY_BY_CODE[row.facility];
                  const pct = Math.round((row.received / row.expected) * 100);
                  const level =
                    row.silentMonths >= 2 ? "hi" : row.silentMonths === 1 ? "md" : "lo";
                  return (
                    <TableRow key={row.facility}>
                      <TableCell>
                        <SeverityRule level={level} />
                        <strong className="font-semibold">{facility.name}</strong>
                        <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                          {row.facility} · {facility.lga} LGA
                        </div>
                      </TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {row.received} / {row.expected}
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="bg-secondary h-[7px] min-w-20 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              "h-full",
                              pct >= 95
                                ? "bg-success"
                                : pct >= 88
                                  ? "bg-brand"
                                  : "bg-warning",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground font-mono text-[0.72rem]">
                          {pct}%
                        </span>
                      </TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {monthLabel(row.lastPeriod)}
                      </TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {row.silentMonths ? (
                          <span
                            className={
                              row.silentMonths >= 2 ? "text-critical" : "text-warning"
                            }
                          >
                            {row.silentMonths} month{row.silentMonths > 1 ? "s" : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            A facility needs at least three consecutive prior reports before a
            non-reporting flag can be raised against it. Facilities that have never
            reported are handled as a registration issue.
          </PanelFootnote>
        </Panel>
      </PageBody>
    </>
  );
}
