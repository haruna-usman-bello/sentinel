import { TonePill } from "@/components/dashboard/badges";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelFootnote } from "@/components/dashboard/panel";
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
import { monthLabel } from "@/lib/domain";
import { listPeriods } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { listCompleteness } from "@/lib/queries/system";
import { cn } from "@/lib/utils";

export default async function CompletenessPage() {
  const { role, scope } = await viewer();
  if (role.key !== "supervisor" && role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["supervisor", "state", "national"]} />;
  }

  const [records, periods] = await Promise.all([listCompleteness(scope), listPeriods()]);
  const months = periods.length;
  const latest = periods.at(-1);

  const expected = records.reduce((sum, r) => sum + r.expected, 0);
  const received = records.reduce((sum, r) => sum + r.received, 0);
  const percent = expected ? Math.round((received / expected) * 100) : null;
  // What needs following up comes first: the longest silent at the top.
  const rows = [...records].sort(
    (a, b) => b.silentMonths - a.silentMonths || a.facilityName.localeCompare(b.facilityName),
  );
  const silentNow = rows.filter((r) => r.silentMonths > 0).length;

  return (
    <>
      {/* No month picker: these records cover every month, so there is none to choose. */}
      <PageHeader title="Reporting completeness" />
      <PageBody>

        <StatStrip
          items={[
            {
              value: silentNow,
              label: `${silentNow === 1 ? "Facility" : "Facilities"} silent now`,
              tone: silentNow ? "warning" : "success",
            },
            {
              value: percent === null ? "—" : `${percent}%`,
              label: `Of expected reports received, ${months} month${months === 1 ? "" : "s"}`,
              tone: percent === null ? undefined : percent >= 95 ? "success" : "warning",
            },
          ]}
        />

        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Now</TableHead>
                  <TableHead>Last report</TableHead>
                  <TableHead>Reports received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-[0.83rem]">
                      No facility has reported yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((row) => {
                  const pct = Math.round((row.received / row.expected) * 100);
                  return (
                    <TableRow key={row.facility}>
                      <TableCell>
                        <strong className="font-semibold">{row.facilityName}</strong>
                        <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                          {row.facility} · {row.lga} LGA
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.silentMonths ? (
                          <TonePill tone={row.silentMonths >= 2 ? "critical" : "warning"}>
                            {row.silentMonths === 1 && latest
                              ? `No report for ${monthLabel(latest)}`
                              : `No report for ${row.silentMonths} months`}
                          </TonePill>
                        ) : (
                          <TonePill tone="success">Reporting</TonePill>
                        )}
                      </TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {monthLabel(row.lastPeriod)}
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <span className="tnum font-mono text-[0.85rem]">
                          {row.received} of {row.expected}
                        </span>
                        <div className="bg-secondary mt-[6px] h-[6px] min-w-20 overflow-hidden rounded-full">
                          <div
                            className={cn("h-full", pct >= 95 ? "bg-success" : pct >= 88 ? "bg-brand" : "bg-warning")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            A facility&apos;s silence is only flagged once it has reported three months running.
            One that has never reported is a registration question, not a silence.
          </PanelFootnote>
        </Panel>
      </PageBody>
    </>
  );
}
