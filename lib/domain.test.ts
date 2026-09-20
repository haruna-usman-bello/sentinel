import { describe, expect, it } from "vitest";

import { EVALUATION, FLAGS, NOTIFICATIONS, caseSeries } from "@/lib/data";
import {
  applyFilters,
  detectorMetrics,
  EMPTY_FILTERS,
  inScope,
  movingAverage,
  paginate,
  recipientsFor,
  scopedNotifications,
  severityOf,
  stateRollup,
  visibleFlags,
} from "@/lib/domain";
import { ROLES } from "@/lib/roles";
import type { Flag } from "@/lib/types";

const zariaFlag = FLAGS.find((f) => f.facility === "F01")!; // Zaria LGA, Kaduna
const giwaFlag = FLAGS.find((f) => f.facility === "F03")!; // Giwa LGA, Kaduna
const edoFlag = FLAGS.find((f) => f.facility === "E01")!; // Edo

describe("inScope", () => {
  it("lets the national tier see everything", () => {
    expect(inScope(edoFlag, {})).toBe(true);
    expect(inScope(zariaFlag, {})).toBe(true);
  });

  it("limits a state coordinator to their own state", () => {
    expect(inScope(zariaFlag, { state: "Kaduna" })).toBe(true);
    expect(inScope(edoFlag, { state: "Kaduna" })).toBe(false);
  });

  it("limits an LGA role to their own LGA", () => {
    expect(inScope(zariaFlag, { state: "Kaduna", lga: "Zaria" })).toBe(true);
    expect(inScope(giwaFlag, { state: "Kaduna", lga: "Zaria" })).toBe(false);
  });

  it("shows the administrator no case data at all", () => {
    expect(inScope(zariaFlag, { none: true })).toBe(false);
  });
});

describe("visibleFlags", () => {
  it("hides flags raised after the selected reporting period", () => {
    const august = visibleFlags(FLAGS, {}, "2026-08");
    const july = visibleFlags(FLAGS, {}, "2026-07");
    expect(august.length).toBe(FLAGS.length);
    expect(july.every((f) => f.period <= "2026-07")).toBe(true);
    expect(july.length).toBeLessThan(august.length);
  });

  it("applies scope and period together", () => {
    const rows = visibleFlags(FLAGS, { state: "Kaduna", lga: "Zaria" }, "2026-08");
    expect(rows.every((f) => f.lga === "Zaria")).toBe(true);
    expect(rows.length).toBe(4);
  });
});

describe("scopedNotifications", () => {
  it("gives the national tier every dispatch", () => {
    expect(scopedNotifications(NOTIFICATIONS, {}, "national")).toHaveLength(
      NOTIFICATIONS.length,
    );
  });

  it("hides national-only dispatches from a state coordinator", () => {
    const rows = scopedNotifications(NOTIFICATIONS, { state: "Kaduna" }, "state");
    expect(rows.every((n) => n.scope.state === "Kaduna")).toBe(true);
    expect(rows.some((n) => n.scope.state === undefined)).toBe(false);
  });

  it("limits an LGA role to dispatches addressed to that LGA", () => {
    const rows = scopedNotifications(
      NOTIFICATIONS,
      { state: "Kaduna", lga: "Zaria" },
      "supervisor",
    );
    expect(rows.length).toBe(1);
    expect(rows[0].scope.lga).toBe("Zaria");
  });

  it("gives the administrator nothing", () => {
    expect(scopedNotifications(NOTIFICATIONS, { none: true }, "sysadmin")).toEqual([]);
  });
});

describe("recipientsFor", () => {
  it("escalates an officer's confirmation to state, national and the LGA supervisor", () => {
    const out = recipientsFor(zariaFlag, "confirmed", ROLES.officer);
    expect(out).toEqual([
      "Kaduna State Coordinator (SMS)",
      "NCDC National Coordinator (SMS)",
      "Zaria LGA Supervisor (SMS)",
    ]);
  });

  it("does not notify the supervisor about their own decision", () => {
    const out = recipientsFor(zariaFlag, "confirmed", ROLES.supervisor);
    expect(out.some((r) => r.startsWith("Zaria LGA Supervisor"))).toBe(false);
  });

  it("only escalates to national on a confirmation", () => {
    const out = recipientsFor(zariaFlag, "false_alarm", ROLES.officer);
    expect(out.some((r) => r.startsWith("NCDC National"))).toBe(false);
  });

  it("uses email where the recipient has no phone on file", () => {
    const flag: Flag = {
      ...zariaFlag,
      escalation: { ...zariaFlag.escalation, supervisor: { name: "Acting Supervisor", channel: "email" } },
    };
    expect(recipientsFor(flag, "confirmed", ROLES.officer)).toContain("Acting Supervisor (email)");
  });

  it("broadcasts nothing for opening or closing", () => {
    expect(recipientsFor(zariaFlag, "investigating", ROLES.officer)).toEqual([]);
    expect(recipientsFor(zariaFlag, "closed", ROLES.state)).toEqual([]);
  });

  it("skips a vacant post", () => {
    const flag: Flag = { ...zariaFlag, escalation: { ...zariaFlag.escalation, supervisor: null } };
    const out = recipientsFor(flag, "confirmed", ROLES.officer);
    expect(out.some((r) => r.includes("Supervisor"))).toBe(false);
    expect(out.length).toBe(2);
  });
});

describe("movingAverage", () => {
  it("averages the previous `window` values, not the current one", () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([null, 10, 15, 25]);
  });

  it("skips gaps rather than treating them as zero", () => {
    expect(movingAverage([10, null, 30, 40], 3)).toEqual([null, 10, 10, 20]);
  });
});

describe("detectorMetrics", () => {
  it("reproduces the reported figures at the 2.0× alert level", () => {
    const m = detectorMetrics(EVALUATION.sweep.find((r) => r.selected)!);
    expect(m.precision).toBeCloseTo(0.673, 3);
    expect(m.recall).toBeCloseTo(0.44, 3);
    expect(m.f1).toBeCloseTo(0.532, 3);
    expect(m.fpr).toBeCloseTo(0.06, 3);
  });

  it("does not divide by zero on an empty sweep", () => {
    expect(detectorMetrics({ k: 1, tp: 0, fp: 0, fn: 0, tn: 0 })).toEqual({
      precision: 0,
      recall: 0,
      f1: 0,
      fpr: 0,
    });
  });
});

describe("caseSeries", () => {
  it("is deterministic for the same facility and disease", () => {
    expect(caseSeries("F01", "Cholera", FLAGS)).toEqual(caseSeries("F01", "Cholera", FLAGS));
  });

  it("uses the flagged count for a flagged month", () => {
    const row = caseSeries("F01", "Cholera", FLAGS).find((r) => r.period === "2026-08");
    expect(row?.count).toBe(41);
  });

  it("records a non-reporting month as null", () => {
    const row = caseSeries("F10", "Measles", FLAGS).find((r) => r.period === "2026-08");
    expect(row?.count).toBeNull();
  });
});

describe("severityOf", () => {
  const base: Flag = { ...zariaFlag };
  it("bands statistical flags by z-score", () => {
    expect(severityOf({ ...base, z: 3.4 })).toBe("hi");
    expect(severityOf({ ...base, z: 2.6 })).toBe("md");
    expect(severityOf({ ...base, z: 2.1 })).toBe("lo");
  });
  it("treats a missing report as medium", () => {
    expect(severityOf({ ...base, type: "non_reporting", z: undefined })).toBe("md");
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 19 }, (_, i) => i);
  it("slices into pages of eight", () => {
    const page = paginate(rows, 2);
    expect(page.pages).toBe(3);
    expect(page.rows).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });
  it("clamps an out-of-range page", () => {
    expect(paginate(rows, 99).page).toBe(3);
    expect(paginate(rows, 0).page).toBe(1);
    expect(paginate([], 1).pages).toBe(1);
  });
});

describe("applyFilters", () => {
  it("matches a free-text search against facility, code and location", () => {
    expect(applyFilters(FLAGS, EMPTY_FILTERS, "wusasa")).toHaveLength(1);
    expect(applyFilters(FLAGS, EMPTY_FILTERS, "E01")).toHaveLength(1);
    expect(applyFilters(FLAGS, EMPTY_FILTERS, "zzz")).toHaveLength(0);
  });
  it("narrows by disease, status, state and LGA", () => {
    const rows = applyFilters(
      FLAGS,
      { ...EMPTY_FILTERS, disease: "Cholera", state: "Kaduna", lga: "Zaria" },
      "",
    );
    expect(rows.every((f) => f.disease === "Cholera" && f.lga === "Zaria")).toBe(true);
    expect(rows.length).toBe(2);
  });
});

describe("stateRollup", () => {
  it("counts per state and sorts by open flags", () => {
    const rollup = stateRollup(FLAGS);
    expect(rollup[0].state).toBe("Kaduna");
    expect(rollup[0].total).toBe(11);
    expect(rollup[0].confirmed).toBe(2);
    expect(rollup[0].silent).toBe(3);
    expect(rollup[0].diseases.sort()).toEqual(["Cholera", "Measles"]);
  });
});
