import { Tag } from "@/components/dashboard/badges";
import { DetectorChart } from "@/components/dashboard/detector-chart";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Grid2,
  Panel,
  PanelBody,
  PanelFootnote,
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
import { detectorMetrics } from "@/lib/domain";
import { viewer } from "@/lib/queries/shared";
import { detectorEvaluation, type DetectorEvaluation } from "@/lib/queries/system";
import { cn } from "@/lib/utils";

export default async function DetectorPage() {
  const { role } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const evaluation = await detectorEvaluation();
  if (!evaluation) {
    return (
      <>
        <PageHeader title="How well the detector performs" />
        <PageBody>
          <p className="text-muted-foreground text-[0.85rem]">
            The detector has not been evaluated yet. Run an evaluation sweep to populate this screen.
          </p>
        </PageBody>
      </>
    );
  }

  return <DetectorAccuracy evaluation={evaluation} />;
}

function ConfusionCell({
  value,
  caption,
  tone,
}: {
  value: number;
  caption: string;
  tone?: "success" | "critical" | "warning";
}) {
  return (
    <div className="bg-card px-[13px] py-[11px]">
      <span
        className={cn(
          "tnum font-mono text-[1.15rem]",
          tone === "success" && "text-success",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
      <small className="text-faint mt-[2px] block text-[0.68rem]">{caption}</small>
    </div>
  );
}

/** Column head that carries a plain-language gloss under the metric's name. */
function MetricHead({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TableHead className="min-w-[150px] align-top">
      {label}
      <div className="text-faint mt-[3px] text-[0.66rem] leading-[1.35] font-normal tracking-normal whitespace-normal normal-case">
        {children}
      </div>
    </TableHead>
  );
}

function DetectorAccuracy({ evaluation: EVALUATION }: { evaluation: DetectorEvaluation }) {
  const selected = EVALUATION.sweep.find((r) => r.selected) ?? EVALUATION.sweep[0];
  const alternate = EVALUATION.sweep.find((r) => r !== selected) ?? selected;
  const selectedMetrics = detectorMetrics(selected);
  const alternateMetrics = detectorMetrics(alternate);

  return (
    <>
      <PageHeader title="How well the detector performs" />
      <PageBody>

        <StatStrip
          items={[
            { value: EVALUATION.records, label: "Months of facility data tested" },
            { value: EVALUATION.seeded, label: "Known outbreaks in the test data" },
            { value: EVALUATION.baselineMonths, label: "Months used as baseline" },
            {
              value: selectedMetrics.f1.toFixed(3),
              label: `Best F1 — at ${selected.k.toFixed(1)}×`,
              tone: "success",
            },
            {
              value: selectedMetrics.recall.toFixed(3),
              label: `Outbreaks caught at ${selected.k.toFixed(1)}×`,
              tone: "warning",
            },
          ]}
        />

        <Panel>
          <PanelHeader
            title="Results at each alert level"
            description="Each row is a full re-run of the detector over the same reference dataset."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="align-top">Alert level</TableHead>
                  <MetricHead label="Precision">
                    of those flagged, how many were real
                  </MetricHead>
                  <MetricHead label="Recall">
                    of the real ones, how many were caught
                  </MetricHead>
                  <MetricHead label="F1 score">the two balanced</MetricHead>
                  <MetricHead label="False alarm rate">
                    of normal months, how many were flagged
                  </MetricHead>
                  <TableHead className="align-top">
                    Correct / False alarm / Missed / Correctly ignored
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EVALUATION.sweep.map((row) => {
                  const m = detectorMetrics(row);
                  return (
                    <TableRow
                      key={row.k}
                      className={row.selected ? "bg-accent" : undefined}
                    >
                      <TableCell
                        className={cn(
                          "tnum font-mono whitespace-nowrap",
                          row.selected && "shadow-[inset_3px_0_0_var(--brand)]",
                        )}
                      >
                        <strong className="font-semibold">{row.k.toFixed(1)}×</strong>
                        {row.selected ? <Tag className="ml-2">in use</Tag> : null}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {m.precision.toFixed(3)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {m.recall.toFixed(3)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        <strong className="font-semibold">{m.f1.toFixed(3)}</strong>
                      </TableCell>
                      <TableCell className="tnum font-mono">{m.fpr.toFixed(3)}</TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {row.tp} / {row.fp} / {row.fn} / {row.tn}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            The {selected.k.toFixed(1)}× level is the one in use: it gave the higher F1
            score ({selectedMetrics.f1.toFixed(3)} against{" "}
            {alternateMetrics.f1.toFixed(3)}) and populated every flag in this system.
          </PanelFootnote>
        </Panel>

        <Grid2>
          <Panel>
            <PanelHeader
              title={`${selected.k.toFixed(1)}× against ${alternate.k.toFixed(1)}×`}
            />
            <PanelBody>
              <DetectorChart selected={selected} alternate={alternate} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Results at the ${selected.k.toFixed(1)}× alert level`}
              description="The level the system runs at."
            />
            <PanelBody>
              <div className="bg-border border-border grid max-w-[420px] grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md border text-[0.83rem]">
                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase" />
                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  Flagged
                </div>
                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  Not flagged
                </div>

                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  Real outbreak month
                </div>
                <ConfusionCell
                  value={selected.tp}
                  caption="correctly flagged"
                  tone="success"
                />
                <ConfusionCell value={selected.fn} caption="missed" tone="warning" />

                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  Normal month
                </div>
                <ConfusionCell
                  value={selected.fp}
                  caption="false alarms"
                  tone="critical"
                />
                <ConfusionCell value={selected.tn} caption="correctly ignored" />
              </div>

              <p className="text-muted-foreground mt-3 text-[0.83rem]">
                {selected.fn} real outbreak months went unflagged at this level, and{" "}
                {selected.fp} false alarms were raised alongside {selected.tp} correct
                ones.
              </p>
            </PanelBody>
          </Panel>
        </Grid2>
      </PageBody>
    </>
  );
}
