"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SeverityRule, StatusPill, Tag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isOpen, stateRollup } from "@/lib/domain";

const TOTAL_STATES = 37;

export default function NationalPage() {
  return (
    <RoleGate allow={["national"]}>
      <NationalSummary />
    </RoleGate>
  );
}

function NationalSummary() {
  const { scopedFlags, period } = useDashboard();
  const router = useRouter();

  const rollup = stateRollup(scopedFlags);

  return (
    <>
      <PageHeader
        title="Nigeria — national summary"
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
            { value: TOTAL_STATES, label: "States + FCT" },
            { value: scopedFlags.length, label: `Flags to ${period}` },
            {
              value: scopedFlags.filter(isOpen).length,
              label: "Still open",
              tone: "warning",
            },
            {
              value: scopedFlags.filter((f) => f.status === "confirmed").length,
              label: "Confirmed outbreaks",
              tone: "critical",
            },
            {
              value: scopedFlags.filter((f) => f.type === "non_reporting").length,
              label: "Facilities not reporting",
            },
          ]}
        />

        <Panel>
          <PanelHeader
            title="States reporting a signal"
            description="Sorted by open flags."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Confirmed</TableHead>
                  <TableHead>Silent</TableHead>
                  <TableHead>Diseases</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollup.map((row) => {
                  const level = row.confirmed > 0 ? "hi" : row.open > 0 ? "md" : "lo";
                  const [label, status] =
                    row.confirmed > 0
                      ? (["Attention", "confirmed"] as const)
                      : row.open > 0
                        ? (["Watch", "pending"] as const)
                        : (["Quiet", "closed"] as const);
                  return (
                    <TableRow
                      key={row.state}
                      className="hover:bg-secondary cursor-pointer"
                      onClick={() =>
                        router.push(`/flags?state=${encodeURIComponent(row.state)}`)
                      }
                    >
                      <TableCell>
                        <SeverityRule level={level} />
                        <Link
                          href={`/flags?state=${encodeURIComponent(row.state)}`}
                          className="font-semibold hover:underline focus-visible:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.state}
                        </Link>
                      </TableCell>
                      <TableCell className="tnum font-mono">{row.total}</TableCell>
                      <TableCell className="tnum font-mono">{row.open}</TableCell>
                      <TableCell className="tnum font-mono">
                        {row.confirmed || "—"}
                      </TableCell>
                      <TableCell className="tnum font-mono">{row.silent || "—"}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {row.diseases.map((d) => (
                            <Tag key={d}>{d}</Tag>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={status} label={label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            {TOTAL_STATES - rollup.length} other states and the FCT show no open flag and
            no reporting gap this period and are not listed.
          </PanelFootnote>
        </Panel>
      </PageBody>
    </>
  );
}
