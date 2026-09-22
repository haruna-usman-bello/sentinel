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

function DetectorAccuracy({ evaluation }: { evaluation: DetectorEvaluation }) {
  const { recommended, sweep, inUse } = evaluation;
  const bestF1 = sweep.reduce((best, r) =>
    detectorMetrics(r).f1 > detectorMetrics(best).f1 ? r : best,
  );
  const adrift = inUse.filter((d) => !d.matchesRecommendation);

  // Compare the recommendation against the level actually in use, which is the
  // decision in front of the reader. Where they already agree, compare against
  // the strictest level tried, to show what tightening would cost.
  const comparison =
    sweep.find((r) => adrift.length && Math.abs(r.k - adrift[0].k) < 0.001) ??
    sweep.filter((r) => r.k !== recommended.k).at(-1) ??
    recommended;
  const comparisonLabel = adrift.length ? "(in use)" : "(strictest tried)";

  return (
    <>
      <PageHeader title="How well the detector performs" />
      <PageBody>

        <StatStrip
          items={[
            { value: evaluation.records, label: "Months of facility data tested" },
            { value: evaluation.seeded, label: "Known outbreaks in the test data" },
            { value: evaluation.scored, label: "Months with enough history to judge" },
            {
              value: `${(recommended.recall * 100).toFixed(0)}%`,
              label: `Outbreaks caught at ${recommended.k.toFixed(2)}×`,
              tone: "warning",
            },
            {
              value: recommended.projected.flagsPer100.toFixed(1),
              label: "Flags per 100 facility-months",
              tone: "success",
            },
          ]}
        />

        {adrift.length ? (
          <div
            role="status"
            className="border-warning/45 bg-warning-soft rounded-md border px-[15px] py-[13px] text-[0.85rem]"
          >
            <strong className="text-warning font-semibold">
              The system is not running at the level this evaluation recommends.
            </strong>
            <div className="mt-1">
              {adrift.map((d) => `${d.disease} is set to ${d.k.toFixed(2)}×`).join(", ")}, against a
              recommended {recommended.k.toFixed(2)}×. At {recommended.k.toFixed(2)}× the detector
              catches {(recommended.recall * 100).toFixed(0)}% of outbreaks; at{" "}
              {adrift[0].k.toFixed(2)}× it catches{" "}
              {(() => {
                const current = sweep.find((r) => Math.abs(r.k - adrift[0].k) < 0.001);
                if (!current) return "fewer";
                const extra =
                  recommended.projected.flagsPer100 - current.projected.flagsPer100;
                return `${(current.recall * 100).toFixed(0)}%, for ${extra.toFixed(1)} fewer flags per 100 facility-months`;
              })()}
              . Alert levels are changed on the{" "}
              <a href="/thresholds" className="text-brand underline underline-offset-2">
                alert levels
              </a>{" "}
              screen.
            </div>
          </div>
        ) : null}

        <Panel>
          <PanelHeader
            title="Results at each alert level"
            description="Each row is a full re-run of the detector over the same corpus."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="align-top">Alert level</TableHead>
                  <MetricHead label="Outbreaks caught">
                    of the real ones, how many were flagged
                  </MetricHead>
                  <MetricHead label="False alarm rate">
                    of normal months, how many were flagged
                  </MetricHead>
                  <MetricHead label="Flags per 100 months">
                    what a supervisor would actually see
                  </MetricHead>
                  <MetricHead label="Of those, real">
                    at an assumed {(evaluation.prevalence * 100).toFixed(0)}% outbreak rate
                  </MetricHead>
                  <MetricHead label="F2 score">
                    the two balanced, counting a miss twice as costly
                  </MetricHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sweep.map((row) => {
                  const isSet = inUse.some((d) => Math.abs(d.k - row.k) < 0.001);
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
                        <strong className="font-semibold">{row.k.toFixed(2)}×</strong>
                        {row.selected ? <Tag className="ml-2">recommended</Tag> : null}
                        {isSet ? <Tag className="ml-2">in use</Tag> : null}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {row.recall.toFixed(3)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {row.falseAlarmRate.toFixed(3)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {row.projected.flagsPer100.toFixed(1)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {row.projected.realPer100.toFixed(1)}
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {row.selected ? (
                          <strong className="font-semibold">
                            {row.projected.f2.toFixed(3)}
                          </strong>
                        ) : (
                          row.projected.f2.toFixed(3)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            Outbreaks caught and the false alarm rate are measured on the corpus and are
            properties of the rule. The last three columns are not: they depend on how
            common outbreaks actually are, and are projected at an assumed{" "}
            {(evaluation.prevalence * 100).toFixed(0)}% of facility-months. The
            recommendation maximises F2 rather than F1, because for early warning a missed
            outbreak and a false alarm are not equally costly — and it holds at every
            outbreak rate from 2% to 5%.
          </PanelFootnote>
        </Panel>

        <Panel>
          <PanelHeader
            title="What it catches, and what it misses"
            description="Recall against the size of the rise — the average above hides this."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size of rise</TableHead>
                  {sweep.map((row) => (
                    <TableHead key={row.k} className="tnum font-mono whitespace-nowrap">
                      {row.k.toFixed(2)}×{row.selected ? " ★" : ""}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommended.bands.map((band, i) => (
                  <TableRow key={band.from}>
                    <TableCell className="whitespace-nowrap">
                      <span className="tnum font-mono">
                        {band.from.toFixed(1)}–{(band.to > 4 ? 4 : band.to).toFixed(1)}×
                      </span>
                      <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                        {band.outbreaks} outbreak{band.outbreaks === 1 ? "" : "s"}
                      </div>
                    </TableCell>
                    {sweep.map((row) => {
                      const cell = row.bands[i];
                      const share = cell && cell.outbreaks ? cell.caught / cell.outbreaks : null;
                      return (
                        <TableCell
                          key={row.k}
                          className={cn(
                            "tnum font-mono",
                            share !== null && share >= 0.9 && "text-success",
                            share !== null && share < 0.5 && "text-critical",
                          )}
                        >
                          {share === null ? "—" : share.toFixed(2)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PanelFootnote>
            A sharp rise is caught almost every time at any level; a rise of half again
            above normal is missed about as often as it is caught. Lowering the alert level
            buys most of its extra recall on the subtle ones, which are the cases where
            early warning would matter most.
          </PanelFootnote>
        </Panel>

        <Grid2>
          <Panel>
            <PanelHeader
              title={`${recommended.k.toFixed(2)}× against ${comparison.k.toFixed(2)}×`}
              description={
                adrift.length
                  ? "What the system would gain by moving to the recommended level."
                  : undefined
              }
            />
            <PanelBody>
              <DetectorChart
                selected={recommended}
                alternate={comparison}
                selectedLabel="(recommended)"
                alternateLabel={comparisonLabel}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Results at the recommended ${recommended.k.toFixed(2)}× level`}
              description="Every judged month, sorted into the four possible outcomes."
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
                  value={recommended.tp}
                  caption="correctly flagged"
                  tone="success"
                />
                <ConfusionCell value={recommended.fn} caption="missed" tone="warning" />

                <div className="bg-secondary text-faint px-[13px] py-[11px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  Normal month
                </div>
                <ConfusionCell
                  value={recommended.fp}
                  caption="false alarms"
                  tone="critical"
                />
                <ConfusionCell value={recommended.tn} caption="correctly ignored" />
              </div>

              <p className="text-muted-foreground mt-3 text-[0.83rem]">
                {recommended.fn} real outbreak months went unflagged at this level, and{" "}
                {recommended.fp} false alarms were raised alongside {recommended.tp} correct
                ones.
              </p>
            </PanelBody>
          </Panel>
        </Grid2>

        <Panel>
          <PanelHeader title="How this was measured" />
          <PanelBody>
            <p className="text-muted-foreground m-0 text-[0.85rem]">
              A detector cannot be measured against real surveillance data, because nobody
              labelled which months were truly outbreaks — that is the question the system
              exists to answer. So it is measured against a generated corpus of{" "}
              {evaluation.records} facility-months where the truth is known by
              construction: ordinary months are drawn from each facility&rsquo;s own level,
              and {evaluation.seeded} outbreak months are that level multiplied by a known
              amount. {evaluation.records - evaluation.scored} early months carry too
              little history to judge and are excluded rather than counted as correct.
            </p>
            <p className="text-muted-foreground mt-3 mb-0 text-[0.85rem]">
              The corpus is deliberately thick with outbreaks — {evaluation.seeded} of{" "}
              {evaluation.scored} judged months — so that every alert level has enough of
              them to measure sensitivity against. Routine surveillance is nothing like
              that, so precision and alert volume are projected down to an assumed{" "}
              {(evaluation.prevalence * 100).toFixed(0)}% rather than read off the corpus,
              where they would look far better than they are.
            </p>
            <p className="text-muted-foreground mt-3 mb-0 text-[0.85rem]">
              These figures say how well the rule separates a rise it was shown from
              ordinary variation of the kind modelled here. They do not say how it behaves
              against real reporting, whose noise is messier — duplicate entries, late
              batches, catchment changes. Read the recall-by-size table above rather than
              the headline.
            </p>
            <p className="text-faint mt-3 mb-0 font-mono text-[0.72rem]">
              Corpus seed {evaluation.corpusSeed} · baseline{" "}
              {evaluation.baselineMonths} months · last measured {evaluation.runAt} · re-run
              with npm run detector:evaluate
            </p>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
