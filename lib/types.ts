/**
 * UI-facing mirrors of the Prisma models. Kept as plain unions so client
 * components never pull the generated Prisma runtime into the browser bundle.
 */

export type Role = "officer" | "supervisor" | "state" | "national" | "sysadmin";

export type FlagType = "statistical" | "non_reporting";

export type FlagStatus =
  | "pending"
  | "investigating"
  | "confirmed"
  | "false_alarm"
  | "closed";

export type NotificationChannel = "sms" | "email";

export type ActivityKind = "auth" | "config" | "account" | "flag";

export type IngestStatus = "ok" | "warn" | "fail";

export const FLAG_STATUSES: FlagStatus[] = [
  "pending",
  "investigating",
  "confirmed",
  "false_alarm",
  "closed",
];

/** A facility with a position on the schematic map. */
export interface FacilityPin {
  code: string;
  name: string;
  lga: string;
  state: string;
  /** Percent of the plot box. */
  mapX: number;
  mapY: number;
}

/** One person a decision is sent to, and how. */
export interface Escalation {
  name: string;
  channel: NotificationChannel;
}

/** The posts a flag's decisions escalate to; null where the post is vacant. */
export interface EscalationTargets {
  supervisor: Escalation | null;
  stateCoordinator: Escalation | null;
  national: Escalation | null;
}

export interface Flag {
  id: string;
  type: FlagType;
  /** Facility code, e.g. "F01". */
  facility: string;
  facilityName: string;
  disease: string;
  period: string;
  status: FlagStatus;
  cases?: number;
  z?: number;
  k?: number;
  state: string;
  lga: string;
  /** When the detector raised it, "YYYY-MM-DD HH:mm" WAT. */
  raisedAt: string;
  escalation: EscalationTargets;
}

export interface FlagLogEntry {
  id: string;
  flag: string;
  at: string;
  actor: string;
  from: FlagStatus | null;
  to: FlagStatus;
  note: string;
}

export interface Notification {
  id: string;
  at: string;
  channel: NotificationChannel;
  recipient: string;
  scope: { state?: string; lga?: string };
  message: string;
  read: boolean;
}

export interface ActivityEntry {
  id: number;
  at: string;
  actor: string;
  state: string;
  kind: ActivityKind;
  action: string;
  detail: string;
}

export interface DiseaseThreshold {
  disease: string;
  k: number;
  setBy: string;
  setAt: string;
}

export interface CompletenessRow {
  facility: string;
  expected: number;
  received: number;
  missed: number;
  silentMonths: number;
  lastPeriod: string;
}

export interface IngestRun {
  at: string;
  status: IngestStatus;
  orgUnits: number;
  dataElements: number;
  periods: number;
  records: number;
  durationMs: number;
  note: string;
}

export interface DetectorSweepRow {
  k: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  selected?: boolean;
}

export interface AccountRecord {
  id: number;
  name: string;
  role: Role;
  state: string;
  lga: string;
  phone: string;
  email: string;
  active: boolean;
  note?: string;
}

export interface Scope {
  state?: string;
  lga?: string;
  /** Marks a role that may see no case data at all. */
  none?: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  badge?: "open" | "notifications";
}

/** What is true of a tier regardless of who holds it. */
export interface RoleDefinition {
  key: Role;
  tier: string;
  label: string;
  blurb: string;
  home: string;
  nav: NavItem[];
  /** Status transitions this role is permitted to make, keyed by current status. */
  can: Record<FlagStatus, FlagStatus[]>;
}

/** A refusal a screen shows in place, so the person knows what did not happen and why. */
export interface Denial {
  title: string;
  body: string;
}

/** The signed-in person. Scope is derived from `role`, `state` and `lga`. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  state?: string;
  lga?: string;
  phone?: string;
}
