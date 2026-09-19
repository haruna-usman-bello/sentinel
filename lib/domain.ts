import {
  ACCOUNTS,
  FACILITY_BY_CODE,
  PERIODS,
  CURRENT_PERIOD,
} from "@/lib/data";
import type {
  DetectorSweepRow,
  Flag,
  FlagStatus,
  Notification,
  RoleDefinition,
  Scope,
} from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08" → "Aug 2026" */
export function monthLabel(period: string): string {
  return `${MONTHS[Number(period.slice(5)) - 1].slice(0, 3)} ${period.slice(0, 4)}`;
}

/** "2026-08" → "August 2026" */
export function monthLong(period: string): string {
  return `${MONTHS[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;
}

/** "2026-08" → "Aug 26", for dense axis ticks. */
export function monthTick(period: string): string {
  return `${MONTHS[Number(period.slice(5)) - 1].slice(0, 3)} ${period.slice(2, 4)}`;
}

export function periodIndex(period: string): number {
  return PERIODS.indexOf(period);
}

export function humanStatus(status: FlagStatus): string {
  return status.replace(/_/g, " ");
}

export function isOpen(flag: Flag): boolean {
  return flag.status === "pending" || flag.status === "investigating";
}

export function inScope(flag: Flag, scope: Scope): boolean {
  if (scope.none) return false;
  if (scope.state && flag.state !== scope.state) return false;
  if (scope.lga && flag.lga !== scope.lga) return false;
  return true;
}

/**
 * The app shows the system as it stood at the selected reporting period:
 * a flag raised after that month is not yet in view.
 */
export function visibleFlags(flags: Flag[], scope: Scope, period: string): Flag[] {
  const cutoff = periodIndex(period);
  return flags.filter((f) => inScope(f, scope) && periodIndex(f.period) <= cutoff);
}

export function matchesQuery(flag: Flag, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const facility = FACILITY_BY_CODE[flag.facility];
  return [facility.name, flag.facility, flag.lga, flag.state, flag.disease, flag.period, flag.status]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export interface FlagFilters {
  disease: string;
  status: string;
  lga: string;
  state: string;
}

export const EMPTY_FILTERS: FlagFilters = {
  disease: "all",
  status: "all",
  lga: "all",
  state: "all",
};

export function applyFilters(flags: Flag[], filters: FlagFilters, query: string): Flag[] {
  return flags.filter(
    (f) =>
      (filters.disease === "all" || f.disease === filters.disease) &&
      (filters.status === "all" || f.status === filters.status) &&
      (filters.lga === "all" || f.lga === filters.lga) &&
      (filters.state === "all" || f.state === filters.state) &&
      matchesQuery(f, query),
  );
}

export const PAGE_SIZE = 8;

export interface Page<T> {
  page: number;
  pages: number;
  rows: T[];
  total: number;
}

export function paginate<T>(rows: T[], requested: number, size = PAGE_SIZE): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, requested), pages);
  return {
    page,
    pages,
    total: rows.length,
    rows: rows.slice((page - 1) * size, page * size),
  };
}

/** Severity band driving the 3px rule beside a facility name. */
export function severityOf(flag: Flag): "hi" | "md" | "lo" {
  if (flag.type === "non_reporting") return "md";
  const z = flag.z ?? 0;
  return z >= 3 ? "hi" : z >= 2.5 ? "md" : "lo";
}

/**
 * Deterministic monthly series for a facility/disease, so the trend chart is
 * identical on every load. Real counts replace the synthetic ones wherever a
 * flag recorded them, and a non-reporting flag punches a null through.
 */
export function caseSeries(
  facilityCode: string,
  disease: string,
  flags: Flag[],
): { period: string; count: number | null }[] {
  const facility = FACILITY_BY_CODE[facilityCode];
  const base = facility.baseline[disease] ?? 6;

  let seed = 0;
  for (const ch of facilityCode + disease) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const out: { period: string; count: number | null }[] = PERIODS.map((period) => ({
    period,
    count: Math.max(0, Math.round(base + (next() - 0.45) * base * 0.7)),
  }));

  for (const flag of flags) {
    if (flag.facility !== facilityCode || flag.disease !== disease) continue;
    const row = out.find((o) => o.period === flag.period);
    if (!row) continue;
    if (flag.type === "statistical" && flag.cases !== undefined) row.count = flag.cases;
    if (flag.type === "non_reporting") row.count = null;
  }
  return out;
}

/** Trailing mean over the previous `window` reported months, skipping gaps. */
export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window), i).filter((v): v is number => v !== null);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export interface DetectorMetrics {
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
}

export function detectorMetrics(row: DetectorSweepRow): DetectorMetrics {
  const precision = row.tp / (row.tp + row.fp || 1);
  const recall = row.tp / (row.tp + row.fn || 1);
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = row.fp / (row.fp + row.tn || 1);
  return { precision, recall, f1, fpr };
}

/** Notifications a role is addressed by, resolved the way the dispatcher does. */
export function scopedNotifications(
  notifications: Notification[],
  role: RoleDefinition,
): Notification[] {
  const scope = role.scope;
  if (role.key === "national") return notifications;
  if (scope.none) return [];
  return notifications.filter((n) => {
    if (scope.state && n.scope.state && n.scope.state !== scope.state) return false;
    if (scope.state && !n.scope.state) return false; // national-only dispatches
    if (scope.lga) return n.scope.lga === scope.lga;
    return true;
  });
}

/** Who a status change escalates to, resolved the way the notifier does. */
export function recipientsFor(flag: Flag, to: FlagStatus, role: RoleDefinition): string[] {
  const out: string[] = [];
  if (role.key === "officer" || role.key === "supervisor") {
    out.push(`${flag.state} State Coordinator (email)`);
  }
  if (to === "confirmed") out.push("NCDC National Coordinator (email)");
  const supervisor = ACCOUNTS.find(
    (u) => u.role === "supervisor" && u.lga === flag.lga && u.active,
  );
  if (supervisor && role.key !== "supervisor") {
    out.push(`${supervisor.name} (${supervisor.phone ? "SMS" : "email"})`);
  }
  return out.length ? out : ["No onward escalation is defined for this transition."];
}

/** Transitions that are confirmed in a dialog before they are taken. */
export const CONSEQUENTIAL: FlagStatus[] = ["confirmed", "false_alarm", "closed"];

export function isConsequential(status: FlagStatus): boolean {
  return CONSEQUENTIAL.includes(status);
}

export interface StateRollup {
  state: string;
  total: number;
  open: number;
  confirmed: number;
  silent: number;
  diseases: string[];
}

export function stateRollup(flags: Flag[]): StateRollup[] {
  const map = new Map<string, StateRollup & { diseaseSet: Set<string> }>();
  for (const flag of flags) {
    let row = map.get(flag.state);
    if (!row) {
      row = {
        state: flag.state,
        total: 0,
        open: 0,
        confirmed: 0,
        silent: 0,
        diseases: [],
        diseaseSet: new Set(),
      };
      map.set(flag.state, row);
    }
    row.total++;
    if (isOpen(flag)) row.open++;
    if (flag.status === "confirmed") row.confirmed++;
    if (flag.type === "non_reporting") row.silent++;
    row.diseaseSet.add(flag.disease);
  }
  return [...map.values()]
    .map(({ diseaseSet, ...rest }) => ({ ...rest, diseases: [...diseaseSet] }))
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

/** The prototype is pinned to a fixed reporting date; only the clock moves. */
export function timestamp(): string {
  return `2026-08-05 ${new Date().toTimeString().slice(0, 8)}`;
}

export function isHistorical(period: string): boolean {
  return period !== CURRENT_PERIOD;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
