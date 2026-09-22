/**
 * The detection rule, free of any I/O so it can be tested on plain arrays.
 *
 * A month is scored against the facility's own recent history: the mean and
 * spread of the reported counts over the preceding `baselineMonths`. It is
 * flagged when it rises more than `k` times that spread above the mean —
 * `k` being the disease's alert level. A month with no report is a signal
 * of its own when the facility had been reporting reliably just before.
 *
 * A series distinguishes three things, and the distinction is the whole
 * point: a number is a count that arrived, `null` is a month we asked about
 * and nothing came back, and `undefined` is a month we never asked about —
 * before the facility joined the system, or while it had no organisation
 * unit to collect from. Silence is only a signal when we asked.
 */

/** One month of a facility's record. See the note above on the three cases. */
export type Reading = number | null | undefined;

function isCount(value: Reading): value is number {
  return typeof value === "number";
}

export const BASELINE_MONTHS = 6;

/** Fewer reported baseline months than this and a z-score would mean little. */
export const MIN_BASELINE_REPORTS = 3;

/** Unbroken prior reports a facility needs before its silence counts as a signal. */
export const SILENCE_HISTORY = 3;

/**
 * Spread is floored at one case: at a facility that reports the same handful
 * every month the sample deviation is near zero, and a single extra case
 * must not read as an outbreak.
 */
const MIN_DEVIATION = 1;

export interface Baseline {
  mean: number;
  deviation: number;
  reports: number;
}

/** Mean and sample deviation of the counts in `values`; anything else is skipped. */
export function baselineOf(values: Reading[]): Baseline {
  const reported = values.filter(isCount);
  const n = reported.length;
  if (!n) return { mean: 0, deviation: MIN_DEVIATION, reports: 0 };
  const mean = reported.reduce((a, b) => a + b, 0) / n;
  const variance =
    n > 1 ? reported.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, deviation: Math.max(Math.sqrt(variance), MIN_DEVIATION), reports: n };
}

export type Verdict =
  | { kind: "statistical"; cases: number; z: number; baseline: Baseline }
  | { kind: "non_reporting" }
  | { kind: "quiet"; z: number | null }
  | { kind: "insufficient_history" }
  /** Nothing was collected for this month, so there is nothing to judge. */
  | { kind: "not_collected" };

/**
 * Scores the last element of `series` — the month under evaluation — against
 * the months before it. `series` is oldest first and must end with the month
 * being evaluated.
 */
export function evaluateMonth(series: Reading[], k: number): Verdict {
  const current = series[series.length - 1];
  const history = series.slice(0, -1);

  if (current === undefined) return { kind: "not_collected" };

  if (current === null) {
    const recent = history.slice(-SILENCE_HISTORY);
    const unbroken = recent.length === SILENCE_HISTORY && recent.every(isCount);
    return unbroken ? { kind: "non_reporting" } : { kind: "insufficient_history" };
  }

  const baseline = baselineOf(history.slice(-BASELINE_MONTHS));
  if (baseline.reports < MIN_BASELINE_REPORTS) return { kind: "insufficient_history" };

  const z = (current - baseline.mean) / baseline.deviation;
  if (z > k) return { kind: "statistical", cases: current, z, baseline };
  return { kind: "quiet", z };
}

export interface CompletenessSummary {
  expected: number;
  received: number;
  missed: number;
  silentMonths: number;
  lastPeriod: string | null;
}

/**
 * A facility's reporting record across every disease it reports on.
 * `byDisease` maps each disease to its series over the same `periods`,
 * oldest first.
 *
 * A facility only owes reports from the month it joined the system, so the
 * record starts at its first collected month — a facility added last quarter
 * is not marked down for the year before it existed.
 */
export function completenessOf(
  periods: string[],
  byDisease: Record<string, Reading[]>,
): CompletenessSummary {
  const diseases = Object.keys(byDisease);
  const empty = { expected: 0, received: 0, missed: 0, silentMonths: 0, lastPeriod: null };
  if (!diseases.length) return empty;

  const joined = periods.findIndex((_, i) =>
    diseases.some((d) => byDisease[d][i] !== undefined),
  );
  if (joined === -1) return empty;

  let expected = 0;
  let received = 0;
  let lastPeriod: string | null = null;
  for (const disease of diseases) {
    for (let i = joined; i < periods.length; i++) {
      const value = byDisease[disease][i];
      if (value === undefined) continue; // never collected — never owed
      expected++;
      if (value === null) continue;
      received++;
      if (!lastPeriod || periods[i] > lastPeriod) lastPeriod = periods[i];
    }
  }

  // Trailing months where every disease was asked and none answered.
  let silentMonths = 0;
  for (let i = periods.length - 1; i >= joined; i--) {
    if (diseases.every((d) => byDisease[d][i] === null)) silentMonths++;
    else break;
  }
  return { expected, received, missed: expected - received, silentMonths, lastPeriod };
}

/** "2026-08" → "202608", the form DHIS2 uses for a monthly period. */
export function toDhis2Period(period: string): string {
  return period.replace("-", "");
}

/** "202608" → "2026-08". */
export function fromDhis2Period(period: string): string {
  return `${period.slice(0, 4)}-${period.slice(4, 6)}`;
}

/** The month after `period`, as "YYYY-MM". */
export function nextPeriod(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const date = new Date(Date.UTC(year, month, 1)); // month is 0-based, so this is the next one
  return date.toISOString().slice(0, 7);
}
