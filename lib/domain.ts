import type {
  DetectorSweepRow,
  Escalation,
  Flag,
  FlagStatus,
  Notification,
  Role,
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
  // "YYYY-MM" orders lexically, so no lookup table is needed.
  return flags.filter((f) => inScope(f, scope) && f.period <= period);
}

export function matchesQuery(flag: Flag, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [flag.facilityName, flag.facility, flag.lga, flag.state, flag.disease, flag.period, flag.status]
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

/** Notifications a user is addressed by, resolved the way the dispatcher does. */
export function scopedNotifications(
  notifications: Notification[],
  scope: Scope,
  role: Role,
): Notification[] {
  if (role === "national") return notifications;
  if (scope.none) return [];
  return notifications.filter((n) => {
    if (scope.state && n.scope.state && n.scope.state !== scope.state) return false;
    if (scope.state && !n.scope.state) return false; // national-only dispatches
    if (scope.lga) return n.scope.lga === scope.lga;
    return true;
  });
}

/**
 * Who a status change escalates to, resolved the way the notifier does:
 * only a confirmation or a dismissal is broadcast; the tier above the actor
 * is told, national is told of every confirmed outbreak, and the LGA
 * supervisor is told unless they made the decision themselves.
 */
export function recipientsFor(flag: Flag, to: FlagStatus, role: RoleDefinition): string[] {
  if (to !== "confirmed" && to !== "false_alarm") return [];
  const { supervisor, stateCoordinator, national } = flag.escalation;
  const describe = (e: Escalation) => `${e.name} (${e.channel === "sms" ? "SMS" : "email"})`;
  const out: string[] = [];
  if ((role.key === "officer" || role.key === "supervisor") && stateCoordinator) {
    out.push(describe(stateCoordinator));
  }
  if (to === "confirmed" && national) out.push(describe(national));
  if (supervisor && role.key !== "supervisor") out.push(describe(supervisor));
  return out;
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

const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "YYYY-MM-DD HH:mm" in West Africa Time, the form every timestamp in the app takes. */
export function formatStamp(date: Date = new Date()): string {
  const part = Object.fromEntries(STAMP.formatToParts(date).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}`;
}

export function isHistorical(period: string, current: string): boolean {
  return period !== current;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
