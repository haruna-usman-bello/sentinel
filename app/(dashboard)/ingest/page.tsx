"use client";

import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Grid2,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/dashboard/panel";
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
import { CURRENT_PERIOD, DHIS2_CONNECTION, INGEST_RUNS } from "@/lib/data";
import { monthLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

const RESULT_LABEL = { ok: "Success", warn: "Partial", fail: "Failed" } as const;
const RESULT_DOT = {
  ok: "bg-success",
  warn: "bg-warning",
  fail: "bg-critical",
} as const;

export default function IngestPage() {
  return (
    <RoleGate allow={["sysadmin"]}>
      <Ingestion />
    </RoleGate>
  );
}

function Ingestion() {
  const last = INGEST_RUNS[0];
  const incidents = INGEST_RUNS.filter((r) => r.status !== "ok").length;

  return (
    <>
      <PageHeader title="DHIS2 ingestion" />
      <PageBody>

        <StatStrip
          items={[
            {
              value: (
                <span className="text-[1.3rem]">{monthLabel(CURRENT_PERIOD)}</span>
              ),
              label: "Last period ingested",
              tone: "success",
            },
            { value: last.records, label: "Records, last pull" },
            { value: last.orgUnits, label: "Org units queried" },
            {
              value: `${(last.durationMs / 1000).toFixed(1)}s`,
              label: "Pull duration",
            },
            {
              value: incidents,
              label: "Incidents, last 5 runs",
              tone: incidents ? "warning" : "success",
            },
          ]}
        />

        <Grid2>
          <Panel>
            <PanelHeader title="Connection" />
            <PanelBody>
              <KeyValue
                items={[
                  {
                    term: "Endpoint",
                    value: (
                      <span className="font-mono text-[0.78rem] break-all">
                        {DHIS2_CONNECTION.endpoint}
                      </span>
                    ),
                  },
                  { term: "Auth", value: DHIS2_CONNECTION.auth },
                  { term: "Org units", value: DHIS2_CONNECTION.orgUnits },
                  { term: "Data elements", value: DHIS2_CONNECTION.dataElements },
                  { term: "Schedule", value: DHIS2_CONNECTION.schedule },
                  { term: "On failure", value: DHIS2_CONNECTION.onFailure },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Current data source" />
            <PanelBody>
              <div
                role="status"
                className="border-warning/45 bg-warning-soft text-warning rounded-md border px-3 py-[9px] text-[0.83rem]"
              >
                <strong className="font-semibold">
                  Live DHIS2 connection unavailable.
                </strong>{" "}
                The system is running on the reference dataset.
              </div>
              <p className="text-muted-foreground mt-3 text-[0.83rem]">
                Case counts currently in the database come from the reference dataset.
                Restoring the connection above resumes scheduled pulls at the next run; no
                configuration change is required.
              </p>
              <div className="mt-3">
                <Button
                  onClick={() =>
                    toast("Pull queued.", {
                      description: "Detection re-runs on whatever arrives.",
                    })
                  }
                >
                  Run ingestion now
                </Button>
              </div>
            </PanelBody>
          </Panel>
        </Grid2>

        <Panel>
          <PanelHeader title="Recent runs" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Org units</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INGEST_RUNS.map((run) => (
                  <TableRow key={run.at}>
                    <TableCell className="tnum font-mono whitespace-nowrap">
                      {run.at}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-[9px] text-[0.85rem]">
                        <span
                          aria-hidden
                          className={cn("size-2 shrink-0 rounded-full", RESULT_DOT[run.status])}
                        />
                        {RESULT_LABEL[run.status]}
                      </span>
                    </TableCell>
                    <TableCell className="tnum font-mono">{run.orgUnits || "—"}</TableCell>
                    <TableCell className="tnum font-mono">{run.records || "—"}</TableCell>
                    <TableCell className="tnum font-mono whitespace-nowrap">
                      {(run.durationMs / 1000).toFixed(2)}s
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[0.82rem]">
                      {run.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
