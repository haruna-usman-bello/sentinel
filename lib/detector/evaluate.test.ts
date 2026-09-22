import { describe, expect, it } from "vitest";

import {
  DEFAULT_CORPUS,
  DEFAULT_LEVELS,
  evaluateAt,
  generateCorpus,
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

describe("recommendLevel", () => {
  it("weights a miss more heavily than a false alarm", () => {
    const results = sweep(corpus, DEFAULT_LEVELS);
    const byF2 = recommendLevel(results);
    const byF1 = results.reduce((best, r) => (r.f1 > best.f1 ? r : best));
    // F2 never recommends a stricter level than F1 — the whole point of it.
    expect(byF2.k).toBeLessThanOrEqual(byF1.k);
    expect(byF2.recall).toBeGreaterThanOrEqual(byF1.recall);
  });
});
