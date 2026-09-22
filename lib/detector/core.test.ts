import { describe, expect, it } from "vitest";

import {
  baselineOf,
  completenessOf,
  evaluateMonth,
  fromDhis2Period,
  nextPeriod,
  toDhis2Period,
} from "@/lib/detector/core";

describe("baselineOf", () => {
  it("takes the mean and sample deviation of the reported months only", () => {
    const b = baselineOf([10, null, 14, 12]);
    expect(b.reports).toBe(3);
    expect(b.mean).toBe(12);
    expect(b.deviation).toBeCloseTo(2, 5);
  });

  it("never lets the deviation fall below one case", () => {
    expect(baselineOf([5, 5, 5, 5]).deviation).toBe(1);
    expect(baselineOf([]).deviation).toBe(1);
  });
});

describe("evaluateMonth", () => {
  const steady = [10, 12, 11, 9, 12, 10];

  it("flags a month that rises more than k deviations above the baseline", () => {
    const verdict = evaluateMonth([...steady, 41], 2.0);
    expect(verdict.kind).toBe("statistical");
    if (verdict.kind === "statistical") {
      expect(verdict.cases).toBe(41);
      expect(verdict.z).toBeGreaterThan(2);
      expect(verdict.baseline.reports).toBe(6);
    }
  });

  it("stays quiet within the usual variation", () => {
    const verdict = evaluateMonth([...steady, 13], 2.0);
    expect(verdict.kind).toBe("quiet");
  });

  it("respects the alert level", () => {
    const series = [...steady, 14]; // about 2.75 deviations up
    expect(evaluateMonth(series, 2.0).kind).toBe("statistical");
    expect(evaluateMonth(series, 3.0).kind).toBe("quiet");
  });

  it("uses only the six months before the one under evaluation", () => {
    // A huge count seven months back must not inflate the baseline.
    const verdict = evaluateMonth([500, ...steady, 30], 2.0);
    expect(verdict.kind).toBe("statistical");
  });

  it("does not score a month with too little history", () => {
    expect(evaluateMonth([10, null, 40], 2.0).kind).toBe("insufficient_history");
  });

  it("treats silence after three unbroken reports as a signal", () => {
    expect(evaluateMonth([8, 9, 7, null], 2.0).kind).toBe("non_reporting");
  });

  it("does not raise on silence when the facility was already patchy", () => {
    expect(evaluateMonth([8, null, 7, null], 2.0).kind).toBe("insufficient_history");
    expect(evaluateMonth([7, null], 2.0).kind).toBe("insufficient_history");
  });

  it("never flags a fall", () => {
    expect(evaluateMonth([...steady, 0], 2.0).kind).toBe("quiet");
  });
});

describe("completenessOf", () => {
  const periods = ["2026-05", "2026-06", "2026-07", "2026-08"];

  it("counts expected and received across every disease", () => {
    const c = completenessOf(periods, { Cholera: [5, 6, null, 7], Measles: [1, 2, 3, 4] });
    expect(c).toMatchObject({ expected: 8, received: 7, missed: 1, silentMonths: 0, lastPeriod: "2026-08" });
  });

  it("counts trailing months where every disease was silent", () => {
    const c = completenessOf(periods, { Cholera: [5, 6, null, null], Measles: [1, 2, null, null] });
    expect(c.silentMonths).toBe(2);
    expect(c.lastPeriod).toBe("2026-06");
  });

  it("is not silent while any disease still reports", () => {
    const c = completenessOf(periods, { Cholera: [5, 6, null, null], Measles: [1, 2, 3, 4] });
    expect(c.silentMonths).toBe(0);
  });
});

describe("periods", () => {
  it("converts to and from the DHIS2 monthly form", () => {
    expect(toDhis2Period("2026-08")).toBe("202608");
    expect(fromDhis2Period("202608")).toBe("2026-08");
  });

  it("steps into the next month across a year boundary", () => {
    expect(nextPeriod("2026-08")).toBe("2026-09");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
});
