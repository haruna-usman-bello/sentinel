import { describe, expect, it } from "vitest";

import {
  ASSUMED_PREVALENCE,
  DEFAULT_CORPUS,
  DEFAULT_LEVELS,
  evaluateAt,
  generateCorpus,
  projectAt,
  recommendLevel,
  sweep,
} from "@/lib/detector/evaluate";

const corpus = generateCorpus();

describe("generateCorpus", () => {
  it("is the same corpus every time, so a sweep can be re-run and argued with", () => {
    expect(generateCorpus()).toEqual(generateCorpus());
  });

  it("is a different corpus under a different seed", () => {
    const other = generateCorpus({ ...DEFAULT_CORPUS, seed: 7 });
    expect(other).not.toEqual(corpus);
    expect(other.length).toBe(corpus.length);
  });

  it("covers the stated dimensions", () => {
    expect(corpus.length).toBe(DEFAULT_CORPUS.facilities * DEFAULT_CORPUS.diseases);
    expect(corpus[0].months.length).toBe(DEFAULT_CORPUS.months);
  });

  it("seeds no outbreak in months the detector could never judge", () => {
    const early = corpus.flatMap((s) => s.months.slice(0, 3));
    expect(early.some((m) => m.outbreak)).toBe(false);
  });

  it("makes outbreak months larger than the facility's usual level", () => {
    for (const series of corpus) {
      for (const month of series.months) {
        if (!month.outbreak) continue;
        expect(month.magnitude).toBeGreaterThanOrEqual(DEFAULT_CORPUS.magnitudes[0]);
        expect(month.magnitude).toBeLessThanOrEqual(DEFAULT_CORPUS.magnitudes[1]);
      }
    }
  });

  it("spans small and large facilities, since the two are not the same problem", () => {
    const baselines = new Set(corpus.map((s) => s.baseline));
    expect(baselines.size).toBe(DEFAULT_CORPUS.baselines.length);
  });
});

describe("evaluateAt", () => {
  it("accounts for every month exactly once", () => {
    const r = evaluateAt(corpus, 2.0);
    expect(r.truePositives + r.falsePositives + r.falseNegatives + r.trueNegatives).toBe(r.scored);
    expect(r.scored).toBeLessThan(r.records);
    expect(r.records).toBe(DEFAULT_CORPUS.facilities * DEFAULT_CORPUS.diseases * DEFAULT_CORPUS.months);
  });

  it("counts every seeded outbreak as either caught or missed", () => {
    const r = evaluateAt(corpus, 2.0);
    expect(r.truePositives + r.falseNegatives).toBe(
      corpus.flatMap((s) => s.months).filter((m) => m.outbreak && m.index >= 3).length,
    );
  });

  it("catches more and cries wolf more as the alert level falls", () => {
    const low = evaluateAt(corpus, 1.25);
    const high = evaluateAt(corpus, 3.0);
    expect(low.recall).toBeGreaterThan(high.recall);
    expect(low.falsePositives).toBeGreaterThan(high.falsePositives);
  });

  it("catches a dramatic rise far more often than a subtle one", () => {
    const r = evaluateAt(corpus, 2.0);
    const subtle = r.byMagnitude[0];
    const dramatic = r.byMagnitude[r.byMagnitude.length - 1];
    expect(dramatic.caught / dramatic.outbreaks).toBeGreaterThan(subtle.caught / subtle.outbreaks);
  });

  it("puts every outbreak in exactly one magnitude band", () => {
    const r = evaluateAt(corpus, 2.0);
    const banded = r.byMagnitude.reduce((sum, b) => sum + b.outbreaks, 0);
    expect(banded).toBe(r.truePositives + r.falseNegatives);
  });
});

describe("projectAt", () => {
  const results = sweep(corpus, DEFAULT_LEVELS);
  const row = results.find((r) => r.k === 2.0)!;

  it("leaves recall alone, since it does not depend on how common outbreaks are", () => {
    expect(projectAt(row, 0.02).recall).toBeCloseTo(projectAt(row, 0.5).recall, 10);
  });

  it("drops precision hard as outbreaks get rarer", () => {
    expect(projectAt(row, 0.02).precision).toBeLessThan(projectAt(row, 0.22).precision);
  });

  it("reproduces the corpus's own precision at the corpus's own rate", () => {
    const rate = row.outbreaks / row.scored;
    expect(projectAt(row, rate).precision).toBeCloseTo(row.precision, 2);
  });

  it("counts fewer flags, and fewer real ones, at a stricter level", () => {
    const strict = projectAt(results.find((r) => r.k === 3.0)!, ASSUMED_PREVALENCE);
    const loose = projectAt(results.find((r) => r.k === 1.0)!, ASSUMED_PREVALENCE);
    expect(strict.flagsPer100).toBeLessThan(loose.flagsPer100);
    expect(strict.realPer100).toBeLessThan(loose.realPer100);
  });
});

describe("recommendLevel", () => {
  const results = sweep(corpus, DEFAULT_LEVELS);

  it("weights a miss more heavily than a false alarm", () => {
    const byF2 = recommendLevel(results);
    const byF1 = results.reduce((best, r) => (r.f1 > best.f1 ? r : best));
    // F2 never recommends a stricter level than F1 — the whole point of it.
    expect(byF2.k).toBeLessThanOrEqual(byF1.k);
    expect(byF2.recall).toBeGreaterThanOrEqual(byF1.recall);
  });

  it("does not take the corpus's outbreak rate for the real one", () => {
    // The corpus is thick with outbreaks so sensitivity can be measured at
    // every level; scoring against that rate would flatter the loosest level.
    const atCorpusRate = recommendLevel(results, results[0].outbreaks / results[0].scored);
    const atRealisticRate = recommendLevel(results, 0.02);
    expect(atRealisticRate.k).toBeGreaterThanOrEqual(atCorpusRate.k);
  });

  it("recommends the same level across the plausible range of outbreak rates", () => {
    const levels = [0.02, 0.03, 0.05].map((p) => recommendLevel(results, p).k);
    expect(new Set(levels).size).toBe(1);
  });
});

/**
 * Whether the alert level should vary by facility, rather than being one
 * national number per disease. It is a tempting idea — a teaching hospital
 * and a rural health post have very different baseline variance — and on the
 * corpus it was tuned against it looks like a clear win. It does not survive
 * being measured on data it has not seen.
 *
 * Tuning a level per facility size on one corpus and applying it to another
 * gives no more recall and no better precision than a single level does: each
 * group carries only a handful of outbreaks, so choosing among seven levels
 * fits their noise rather than anything about facility size. The chosen levels
 * bear this out — they scatter, with no trend against facility size at all.
 *
 * This test is here to keep the conclusion from being quietly re-litigated.
 * If a future change to the rule makes per-facility tuning genuinely pay, this
 * is the test that will fail, and that is the signal to build it.
 */
describe("tuning the alert level per facility", () => {
  const f2At = (series: typeof corpus, k: number) =>
    projectAt(evaluateAt(series, k), ASSUMED_PREVALENCE).f2;

  const bestFor = (series: typeof corpus) =>
    DEFAULT_LEVELS.map((k) => ({ k, score: f2At(series, k) })).reduce((best, row) =>
      row.score > best.score ? row : best,
    ).k;

  const sizes = [...new Set(corpus.map((s) => s.baseline))].sort((a, b) => a - b);
  const oneLevel = bestFor(corpus);
  const perSize = new Map(sizes.map((size) => [size, bestFor(corpus.filter((s) => s.baseline === size))]));

  /** Recall and projected precision over a corpus, under either policy. */
  function measure(series: typeof corpus, level: (baseline: number) => number) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const size of sizes) {
      const r = evaluateAt(series.filter((s) => s.baseline === size), level(size));
      tp += r.truePositives;
      fp += r.falsePositives;
      fn += r.falseNegatives;
      tn += r.trueNegatives;
    }
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const fpr = fp + tn ? fp / (fp + tn) : 0;
    const precision =
      ASSUMED_PREVALENCE * recall + (1 - ASSUMED_PREVALENCE) * fpr
        ? (ASSUMED_PREVALENCE * recall) /
          (ASSUMED_PREVALENCE * recall + (1 - ASSUMED_PREVALENCE) * fpr)
        : 0;
    return { recall, precision };
  }

  it("picks levels that scatter, with no trend against facility size", () => {
    const chosen = sizes.map((s) => perSize.get(s)!);
    // If size drove the right level, the sequence would move in one direction.
    const rising = chosen.every((k, i) => i === 0 || k >= chosen[i - 1]);
    const falling = chosen.every((k, i) => i === 0 || k <= chosen[i - 1]);
    expect(rising || falling).toBe(false);
  });

  it("buys nothing on corpora it was not tuned against", () => {
    const held = [11, 22, 33, 44, 55, 66].map((seed) =>
      generateCorpus({ ...DEFAULT_CORPUS, seed }),
    );

    const flat = held.map((c) => measure(c, () => oneLevel));
    const tuned = held.map((c) => measure(c, (size) => perSize.get(size)!));

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(tuned.map((m) => m.precision))).toBeLessThanOrEqual(
      mean(flat.map((m) => m.precision)),
    );
    expect(mean(tuned.map((m) => m.recall))).toBeLessThanOrEqual(
      mean(flat.map((m) => m.recall)) + 0.005,
    );
  });
});
