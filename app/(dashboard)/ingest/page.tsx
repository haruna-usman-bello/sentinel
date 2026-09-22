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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthLabel } from "@/lib/domain";
import { currentPeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { ingestionOverview, listIngestRuns, listMappings } from "@/lib/queries/system";

import { Dhis2Mapping } from "./dhis2-mapping";
import { RunIngestionButton } from "./run-ingestion-button";
import { cn } from "@/lib/utils";

const RESULT_LABEL = { ok: "Success", warn: "Partial", fail: "Failed" } as const;
const RESULT_DOT = {
  ok: "bg-success",
  warn: "bg-warning",
  fail: "bg-critical",
} as const;

export default async function IngestPage() {
  const { role } = await viewer();
  if (role.key !== "sysadmin") return <RoleGate allow={["sysadmin"]} />;

  const [runs, connection, period, mappings] = await Promise.all([
    listIngestRuns(),
    ingestionOverview(),
    currentPeriod(),
    listMappings(),
  ]);
  const last = runs[0];
  const incidents = runs.filter((r) => r.status !== "ok").length;

  return (
    <>
      <PageHeader title="DHIS2 ingestion" />
      <PageBody>

        <StatStrip
          items={[
            {
              value: (
                <span className="text-[1.3rem]">{monthLabel(period)}</span>
              ),
              label: "Last period ingested",
              tone: "success",
            },
            { value: last?.records ?? 0, label: "Records, last pull" },
            { value: last?.orgUnits ?? 0, label: "Org units queried" },
            {
              value: `${((last?.durationMs ?? 0) / 1000).toFixed(1)}s`,
              label: "Pull duration",
            },
            {
              value: incidents,
              label: `Incidents, last ${runs.length} runs`,
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
                        {connection.endpoint ?? "Not configured — set DHIS2_BASE_URL"}
                      </span>
                    ),
                  },
                  { term: "Auth", value: "Stored on the server and never shown in the browser" },
                  { term: "Org units", value: connection.orgUnits },
                  { term: "Data elements", value: connection.dataElements },
                  { term: "Schedule", value: connection.schedule },
                  { term: "On failure", value: connection.onFailure },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Current data source" />
            <PanelBody>
              {connection.live && connection.mapped === 0 ? (
                <div
                  role="status"
                  className="border-warning/45 bg-warning-soft text-warning rounded-md border px-3 py-[9px] text-[0.83rem]"
                >
                  <strong className="font-semibold">No facility is mapped yet.</strong> A pull
                  returns nothing until each facility carries the organisation unit it reports as.
                </div>
              ) : connection.live ? (
                <div
                  role="status"
                  className="border-success/45 bg-success-soft text-success rounded-md border px-3 py-[9px] text-[0.83rem]"
                >
                  <strong className="font-semibold">Live DHIS2 connection configured.</strong>{" "}
                  Scheduled pulls read from the endpoint above.
                </div>
              ) : (
                <div
                  role="status"
                  className="border-warning/45 bg-warning-soft text-warning rounded-md border px-3 py-[9px] text-[0.83rem]"
                >
                  <strong className="font-semibold">Live DHIS2 connection unavailable.</strong>{" "}
                  The system is running on the reference dataset.
                </div>
              )}
              <p className="text-muted-foreground mt-3 text-[0.83rem]">
                {connection.live
                  ? "Each pull replaces the month's case counts and re-runs detection on what arrived."
                  : "Case counts currently in the database come from the reference dataset. Setting DHIS2_BASE_URL, DHIS2_USERNAME and DHIS2_PASSWORD resumes scheduled pulls at the next run."}
              </p>
              <div className="mt-3">
                <RunIngestionButton />
              </div>
            </PanelBody>
          </Panel>
        </Grid2>

        <Dhis2Mapping facilities={mappings.facilities} diseases={mappings.diseases} />

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
                {runs.map((run) => (
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
