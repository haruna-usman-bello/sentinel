import {
  BASELINE_MONTHS,
  MIN_BASELINE_REPORTS,
  evaluateMonth,
  type Reading,
} from "./core";

/**
 * Measuring the detector.
 *
 * You cannot measure a detector against real surveillance data, because
 * nobody labelled which months were really outbreaks — that is the very
 * question the system exists to answer. So the detector is measured against
 * a corpus generated here, where every month's truth is known by
 * construction: normal months are drawn from a facility's own level, and
 * outbreak months are that level multiplied by a known amount.
 *
 * What that buys and what it does not: these figures say how well the rule
 * separates a rise it was shown from ordinary variation of the kind modelled
 * here. They do not say how the rule behaves against real reporting, whose
 * noise is messier — duplicate entries, late batches, catchment changes. Read
 * the recall-by-magnitude table rather than the headline: a detector that
 * catches every 4× rise and no 1.5× rise has a respectable average and a
 * specific, important blind spot.
 *
 * Everything here is deterministic given a seed, so a sweep can be re-run
 * and argued with.
 */

/** mulberry32 — small, fast, and good enough for generating a test corpus. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A count of cases is a count of events, so it is drawn from a Poisson
 * distribution rather than a normal one — which also means its variance
 * rises with its mean, the property that makes a small facility's counts
 * look proportionally noisier than a large one's.
 */
function poisson(mean: number, next: () => number): number {
  if (mean <= 0) return 0;
  // Knuth's method; mean is small enough here that it will not underflow.
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= next();
  } while (p > limit);
  return k - 1;
}

export interface LabelledMonth {
  index: number;
  count: Reading;
  /** True where this month was generated as an outbreak. */
  outbreak: boolean;
  /** How many times the facility's usual level, for an outbreak month. */
  magnitude: number | null;
}

export interface LabelledSeries {
  facility: string;
  disease: string;
  baseline: number;
  months: LabelledMonth[];
}

export interface CorpusOptions {
  seed: number;
  facilities: number;
  diseases: number;
  months: number;
  /** Usual monthly case level, cycled across facilities. */
  baselines: number[];
  /** Share of scoreable months generated as outbreaks. */
  outbreakRate: number;
  /** Smallest and largest multiple of the usual level an outbreak reaches. */
  magnitudes: [number, number];
}

export const DEFAULT_CORPUS: CorpusOptions = {
  seed: 20260805,
  facilities: 10,
  diseases: 2,
  months: 20,
  // A teaching hospital and a rural health post are not the same problem.
  baselines: [5, 7, 9, 12, 14, 18, 22, 28, 35, 48],
  outbreakRate: 0.27,
  magnitudes: [1.5, 4.0],
};

export function generateCorpus(options: CorpusOptions = DEFAULT_CORPUS): LabelledSeries[] {
  const next = rng(options.seed);
  const out: LabelledSeries[] = [];

  for (let f = 0; f < options.facilities; f++) {
    const baseline = options.baselines[f % options.baselines.length];
    for (let d = 0; d < options.diseases; d++) {
      const months: LabelledMonth[] = [];
      for (let m = 0; m < options.months; m++) {
        // The first months carry no history, so an outbreak there could never
        // be caught by anyone — generating one would only flatter or punish
        // the detector for something it never sees.
        const scoreable = m >= MIN_BASELINE_REPORTS;
        const outbreak = scoreable && next() < options.outbreakRate;
        if (!outbreak) {
          months.push({ index: m, count: poisson(baseline, next), outbreak: false, magnitude: null });
          continue;
        }
        const [low, high] = options.magnitudes;
        const magnitude = low + next() * (high - low);
        months.push({
          index: m,
          count: poisson(baseline * magnitude, next),
          outbreak: true,
          magnitude,
        });
      }
      out.push({ facility: `SYN${String(f + 1).padStart(2, "0")}`, disease: `D${d + 1}`, baseline, months });
    }
  }
  return out;
}

export interface MagnitudeBand {
  /** Inclusive lower bound, exclusive upper. */
  from: number;
  to: number;
  outbreaks: number;
  caught: number;
}

export interface SweepResult {
  k: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** Months the detector was able to judge at all. */
  scored: number;
  /** Months in the corpus, judged or not. */
  records: number;
  outbreaks: number;
  precision: number;
  recall: number;
  f1: number;
  /** Recall weighted twice as heavily as precision. */
  f2: number;
  byMagnitude: MagnitudeBand[];
}

const BANDS: [number, number][] = [
  [1.5, 2.0],
  [2.0, 2.5],
  [2.5, 3.0],
  [3.0, 4.01],
];

/** Runs the rule over the whole corpus at one alert level. */
export function evaluateAt(corpus: LabelledSeries[], k: number): SweepResult {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let scored = 0;
  let records = 0;
  let outbreaks = 0;

  const bands: MagnitudeBand[] = BANDS.map(([from, to]) => ({ from, to, outbreaks: 0, caught: 0 }));

  for (const series of corpus) {
    const counts = series.months.map((m) => m.count);
    for (let i = 0; i < series.months.length; i++) {
      const month = series.months[i];
      records++;
      if (month.outbreak) outbreaks++;

      const verdict = evaluateMonth(counts.slice(0, i + 1), k);
      if (verdict.kind === "insufficient_history" || verdict.kind === "not_collected") continue;
      scored++;

      const flagged = verdict.kind === "statistical";
      if (month.outbreak) {
        if (flagged) tp++;
        else fn++;
        const band = bands.find((b) => month.magnitude! >= b.from && month.magnitude! < b.to);
        if (band) {
          band.outbreaks++;
          if (flagged) band.caught++;
        }
      } else if (flagged) {
        fp++;
      } else {
        tn++;
      }
    }
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f = (beta: number) => {
    const b2 = beta * beta;
    const denominator = b2 * precision + recall;
    return denominator ? ((1 + b2) * precision * recall) / denominator : 0;
  };

  return {
    k,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    scored,
    records,
    outbreaks,
    precision,
    recall,
    f1: f(1),
    f2: f(2),
    byMagnitude: bands,
  };
}

/** The alert levels a sweep tries by default, low enough to show the trade-off. */
export const DEFAULT_LEVELS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export function sweep(
  corpus: LabelledSeries[],
  levels: number[] = DEFAULT_LEVELS,
): SweepResult[] {
  return levels.map((k) => evaluateAt(corpus, k));
}

/**
 * The level a sweep recommends. For early warning a miss costs far more than
 * a false alarm — a missed outbreak is measured in lives, a false alarm in a
 * supervisor's afternoon — so the recommendation maximises F2, which weights
 * recall twice as heavily as precision, rather than F1, which treats the two
 * as equally costly.
 */
export function recommendLevel(results: SweepResult[]): SweepResult {
  return results.reduce((best, row) => (row.f2 > best.f2 ? row : best));
}

export { BASELINE_MONTHS, MIN_BASELINE_REPORTS };
