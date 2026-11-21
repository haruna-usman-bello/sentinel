import Link from "next/link";

import { Tag } from "@/components/dashboard/badges";
import { DetectorChart } from "@/components/dashboard/detector-chart";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stampLabel } from "@/lib/domain";
import { viewer } from "@/lib/queries/shared";
import { detectorEvaluation, type DetectorEvaluation, type SweepRow } from "@/lib/queries/system";
import { cn } from "@/lib/utils";

export default async function DetectorPage() {
  const { role } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const evaluation = await detectorEvaluation();
  if (!evaluation) {
    return (
      <>
        <PageHeader title="Detector accuracy" />
        <PageBody>
          <Lead>
            <strong>The detector has not been tested yet.</strong> Run{" "}
            <code className="font-mono text-[0.9em]">npm run detector:evaluate</code> to measure it
            at every alert level; the results appear here.
          </Lead>
        </PageBody>
      </>
    );
  }

  return <DetectorAccuracy evaluation={evaluation} />;
}

/** Alert levels are tried in steps of a quarter, so two places say each one exactly. */
const level = (k: number) => `${k.toFixed(2)}×`;
const inHundred = (rate: number) => `${Math.round(rate * 100)} in 100`;
const percent = (rate: number, places = 0) => `${(rate * 100).toFixed(places)}%`;

/** One level's result as a bar: the share of known outbreaks it caught. */
function CompareRow({ row, title, note, emphasis }: { row: SweepRow; title: string; note: string; emphasis?: boolean }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 @lg:grid-cols-[11rem_minmax(0,1fr)_12rem] @lg:items-center">
        <span className="flex flex-col">
          <span className="text-[0.92rem] font-semibold">{title}</span>
          <span className="text-muted-foreground text-[0.82rem]">{note}</span>
        </span>
        <span className="bg-card relative block h-3 overflow-hidden rounded-full" aria-hidden>
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", emphasis ? "bg-brand" : "bg-faint")}
            style={{ width: percent(row.recall) }}
          />
        </span>
        <span className="text-muted-foreground text-[0.88rem]">
          <strong className="text-foreground font-semibold">{inHundred(row.recall)}</strong> caught,{" "}
          {row.projected.flagsPer100.toFixed(1)} flags
        </span>
      </div>
    </div>
  );
}

function OutcomeCell({ value, caption, tone }: { value: number; caption: string; tone?: "success" | "critical" | "warning" }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <span
        className={cn(
          "text-[1.15rem] font-semibold",
          tone === "success" && "text-success",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </span>
      <small className="text-muted-foreground mt-0.5 block text-[0.8rem]">{caption}</small>
    </div>
  );
}

function DetectorAccuracy({ evaluation }: { evaluation: DetectorEvaluation }) {
  const { recommended, sweep, inUse } = evaluation;
  const adrift = inUse.filter((d) => !d.matchesRecommendation);
  const current = adrift.length ? sweep.find((r) => Math.abs(r.k - adrift[0].k) < 0.001) : undefined;
  const sameLevel = adrift.filter((d) => current && Math.abs(d.k - current.k) < 0.001).map((d) => d.disease);

  // The chart compares the recommendation with the level in use, which is the
  // decision in front of the reader. Where they already agree, it compares with
  // the strictest level tried, to show what tightening would cost.
  const comparison = current ?? sweep.filter((r) => r.k !== recommended.k).at(-1) ?? recommended;
  const comparisonLabel = current ? "(in use)" : "(strictest tried)";

  const extraFlags = current ? recommended.projected.flagsPer100 - current.projected.flagsPer100 : 0;

  return (
    <>
      <PageHeader title="Detector accuracy" />
      <PageBody>
        {current ? (
          <section className="bg-brand-soft flex flex-col gap-4 rounded-xl p-5">
            <h2 className="text-[1.15rem] font-semibold">
              {recommended.k < current.k
                ? "A lower alert level would catch more outbreaks"
                : "A higher alert level would raise fewer false alarms"}
            </h2>
            <p className="text-muted-foreground max-w-[66ch] text-[0.95rem]">
              In testing, the recommended level of {level(recommended.k)} caught {inHundred(recommended.recall)}{" "}
              known outbreaks. Today&apos;s level of {level(current.k)} caught {inHundred(current.recall)}.{" "}
              {extraFlags > 0
                ? `The cost is about ${extraFlags.toFixed(1)} more flags for every 100 facility-months.`
                : `It would also raise about ${Math.abs(extraFlags).toFixed(1)} fewer flags for every 100 facility-months.`}
            </p>
            <div className="flex flex-col gap-3">
              <CompareRow row={current} title={`Today, ${level(current.k)}`} note={sameLevel.join(" and ")} />
              <CompareRow row={recommended} title={`Recommended, ${level(recommended.k)}`} note="Best balance in testing" emphasis />
            </div>
            <div>
              <Button asChild>
                <Link href="/thresholds">Change alert levels</Link>
              </Button>
            </div>
          </section>
        ) : (
          <Lead>
            <strong>The detector runs at the level testing recommends, {level(recommended.k)}.</strong> At
            that level it caught {inHundred(recommended.recall)} known outbreaks, with about{" "}
            {recommended.projected.flagsPer100.toFixed(1)} flags for every 100 facility-months.
          </Lead>
        )}

        <div>
          <Disclosure title="Results at every alert level" note={`${sweep.length} levels tested`}>
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert level</TableHead>
                    <TableHead>Outbreaks caught</TableHead>
                    <TableHead>Normal months flagged</TableHead>
                    <TableHead>Flags per 100 facility-months</TableHead>
                    <TableHead>Of those, real</TableHead>
                    <TableHead>F2 score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sweep.map((row) => {
                    const isSet = inUse.some((d) => Math.abs(d.k - row.k) < 0.001);
                    return (
                      <TableRow key={row.k} className={row.selected ? "bg-brand-soft/60 font-semibold" : undefined}>
                        <TableCell>
                          {level(row.k)}
                          {row.selected ? <Tag className="ml-2 font-normal">recommended</Tag> : null}
                          {isSet ? <Tag className="ml-2 font-normal">in use</Tag> : null}
                        </TableCell>
                        <TableCell>{inHundred(row.recall)}</TableCell>
                        <TableCell>{percent(row.falseAlarmRate, 1)}</TableCell>
                        <TableCell>{row.projected.flagsPer100.toFixed(1)}</TableCell>
                        <TableCell>{row.projected.realPer100.toFixed(1)}</TableCell>
                        <TableCell>{row.projected.f2.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-muted-foreground max-w-[76ch] text-[0.86rem]">
                Outbreaks caught and normal months flagged are measured on the test data and belong to
                the rule itself. The last three columns depend on how common outbreaks really are, and
                are projected at an assumed {percent(evaluation.prevalence)} of facility-months. The
                recommendation favours the F2 score, which counts a missed outbreak as twice as costly
                as a false alarm, and it holds at every outbreak rate from 2% to 5%.
              </p>
            </div>
          </Disclosure>

          <Disclosure title="Which outbreaks it misses">
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size of rise</TableHead>
                    {sweep.map((row) => (
                      <TableHead key={row.k}>
                        {level(row.k)}
                        {row.selected ? <span className="text-brand"> recommended</span> : null}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommended.bands.map((band, i) => (
                    <TableRow key={band.from}>
                      <TableCell>
                        {band.from.toFixed(1)} to {(band.to > 4 ? 4 : band.to).toFixed(1)} times usual
                        <div className="text-muted-foreground text-[0.8rem]">
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
                              share !== null && share >= 0.9 && "text-success",
                              share !== null && share < 0.5 && "text-critical",
                            )}
                          >
                            {share === null ? "—" : percent(share)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-muted-foreground max-w-[76ch] text-[0.86rem]">
                A sharp rise is caught almost every time at any level. A rise of half again above
                normal is missed about as often as it is caught. Lowering the alert level buys most of
                its extra catches on these subtle rises, which are where early warning matters most.
              </p>
            </div>
          </Disclosure>

          <Disclosure title={`${level(recommended.k)} against ${level(comparison.k)} in detail`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DetectorChart
                selected={recommended}
                alternate={comparison}
                selectedLabel="(recommended)"
                alternateLabel={comparisonLabel}
              />
              <div className="flex flex-col gap-3">
                <h3 className="text-[0.95rem] font-semibold">Every judged month at {level(recommended.k)}</h3>
                <div className="bg-border grid max-w-[420px] grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-lg border text-[0.84rem]">
                  <div className="bg-secondary px-3 py-2.5" />
                  <div className="bg-secondary text-muted-foreground px-3 py-2.5 text-[0.8rem] font-medium">Flagged</div>
                  <div className="bg-secondary text-muted-foreground px-3 py-2.5 text-[0.8rem] font-medium">Not flagged</div>
                  <div className="bg-secondary text-muted-foreground px-3 py-2.5 text-[0.8rem] font-medium">Real outbreak</div>
                  <OutcomeCell value={recommended.tp} caption="caught" tone="success" />
                  <OutcomeCell value={recommended.fn} caption="missed" tone="warning" />
                  <div className="bg-secondary text-muted-foreground px-3 py-2.5 text-[0.8rem] font-medium">Normal month</div>
                  <OutcomeCell value={recommended.fp} caption="false alarms" tone="critical" />
                  <OutcomeCell value={recommended.tn} caption="rightly left alone" />
                </div>
                <p className="text-muted-foreground text-[0.86rem]">
                  {recommended.fn} real outbreak months went unflagged at this level, and {recommended.fp} false
                  alarms were raised alongside {recommended.tp} correct ones.
                </p>
              </div>
            </div>
          </Disclosure>

          <Disclosure title="How this was measured">
            <div className="text-muted-foreground flex max-w-[76ch] flex-col gap-3 text-[0.9rem]">
              <p>
                Real surveillance data cannot test a detector, because nobody has labelled which months
                were truly outbreaks: that is the question Sentinel exists to answer. So it is tested on{" "}
                {evaluation.records} made-up facility-months where the answer is known. Ordinary months are
                drawn from each facility&apos;s own level, and {evaluation.seeded} outbreak months are that
                level multiplied by a known amount. {evaluation.records - evaluation.scored} early months
                have too little history to judge and are left out rather than counted as correct.
              </p>
              <p>
                The test data is deliberately thick with outbreaks, {evaluation.seeded} of the{" "}
                {evaluation.scored} judged months, so every alert level has enough of them to measure. Real
                surveillance is nothing like that, so the flag counts are projected down to an assumed{" "}
                {percent(evaluation.prevalence)} rather than read off the test data, where they would look
                far better than they are.
              </p>
              <p>
                These figures say how well the rule tells a rise from ordinary variation of the kind
                modelled here. Real reporting is messier, with duplicate entries, late batches and
                catchment changes, so trust the table of which outbreaks it misses more than the headline.
              </p>
              <p className="text-[0.84rem]">
                Last measured {stampLabel(evaluation.runAt)}, against a {evaluation.baselineMonths}-month
                usual level, from test data seed {evaluation.corpusSeed}. To measure again, run{" "}
                <code className="font-mono text-[0.9em]">npm run detector:evaluate</code>.
              </p>
            </div>
          </Disclosure>
        </div>
      </PageBody>
    </>
  );
}
