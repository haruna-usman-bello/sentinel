import type {
  AccountRecord,
  ActivityEntry,
  CompletenessRow,
  DetectorSweepRow,
  DiseaseThreshold,
  Facility,
  Flag,
  FlagLogEntry,
  IngestRun,
  Notification,
} from "@/lib/types";

/** Reporting periods the app can be wound back to, oldest first. */
export const PERIODS = [
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07",
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
  "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
];

export const CURRENT_PERIOD = "2026-08";
export const LAST_DETECTION_RUN = "2026-08-05 06:02";

export const DISEASES = ["Cholera", "Measles"];

/** The six geopolitical zones NCDC reports by. */
export const ZONES: Record<string, string[]> = {
  "North West": ["Kaduna", "Sokoto", "Katsina", "Kano", "Kebbi", "Zamfara", "Jigawa"],
  "North East": ["Borno", "Adamawa", "Bauchi", "Gombe", "Taraba", "Yobe"],
  "North Central": ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT"],
  "South West": ["Ondo", "Lagos", "Ogun", "Osun", "Oyo", "Ekiti"],
  "South East": ["Enugu", "Abia", "Anambra", "Ebonyi", "Imo"],
  "South South": ["Edo", "Rivers", "Akwa Ibom", "Bayelsa", "Cross River", "Delta"],
};

export const FACILITIES: Facility[] = [
  { code: "F01", name: "Zaria General Hospital", lga: "Zaria", state: "Kaduna", mapX: 26, mapY: 34, baseline: { Cholera: 12, Measles: 7 } },
  { code: "F05", name: "Tudun Wada Clinic", lga: "Zaria", state: "Kaduna", mapX: 38, mapY: 52, baseline: { Cholera: 8, Measles: 5 } },
  { code: "F10", name: "Wusasa Mission Hospital", lga: "Zaria", state: "Kaduna", mapX: 19, mapY: 57, baseline: { Cholera: 9, Measles: 6 } },
  { code: "F02", name: "Sabon Gari PHC", lga: "Sabon Gari", state: "Kaduna", mapX: 57, mapY: 24, baseline: { Cholera: 10, Measles: 6 } },
  { code: "F06", name: "Kongo Clinic", lga: "Sabon Gari", state: "Kaduna", mapX: 69, mapY: 38, baseline: { Cholera: 6, Measles: 5 } },
  { code: "F07", name: "Samaru Health Post", lga: "Sabon Gari", state: "Kaduna", mapX: 61, mapY: 47, baseline: { Cholera: 5, Measles: 4 } },
  { code: "F03", name: "Giwa Cottage Hospital", lga: "Giwa", state: "Kaduna", mapX: 14, mapY: 78, baseline: { Cholera: 9, Measles: 6 } },
  { code: "F08", name: "Giwa North PHC", lga: "Giwa", state: "Kaduna", mapX: 31, mapY: 86, baseline: { Cholera: 6, Measles: 5 } },
  { code: "F04", name: "Kudan PHC", lga: "Kudan", state: "Kaduna", mapX: 82, mapY: 66, baseline: { Cholera: 7, Measles: 5 } },
  { code: "F09", name: "Hunkuyi PHC", lga: "Kudan", state: "Kaduna", mapX: 89, mapY: 82, baseline: { Cholera: 5, Measles: 4 } },
  { code: "E01", name: "Irrua Specialist Hospital", lga: "Esan Central", state: "Edo", baseline: { Cholera: 8 } },
  { code: "B01", name: "Maiduguri Teaching Hospital", lga: "Maiduguri MC", state: "Borno", baseline: { Measles: 11 } },
  { code: "S01", name: "Sokoto Specialist Hospital", lga: "Sokoto North", state: "Sokoto", baseline: { Measles: 6 } },
  { code: "K01", name: "Katsina General Hospital", lga: "Katsina", state: "Katsina", baseline: { Measles: 8 } },
  { code: "N01", name: "Murtala Muhammad Hospital", lga: "Kano Municipal", state: "Kano", baseline: { Cholera: 19 } },
  { code: "O01", name: "Ondo State Specialist Hospital", lga: "Akure South", state: "Ondo", baseline: { Cholera: 7 } },
];

export const FACILITY_BY_CODE: Record<string, Facility> = Object.fromEntries(
  FACILITIES.map((f) => [f.code, f]),
);

type SeedFlag = Omit<Flag, "state" | "lga">;

const SEED_FLAGS: SeedFlag[] = [
  { id: 1, type: "statistical", facility: "F01", disease: "Cholera", period: "2026-08", cases: 41, z: 3.42, k: 2.0, status: "pending" },
  { id: 2, type: "statistical", facility: "F05", disease: "Cholera", period: "2026-07", cases: 22, z: 2.31, k: 2.0, status: "investigating" },
  { id: 3, type: "non_reporting", facility: "F10", disease: "Measles", period: "2026-08", status: "pending" },
  { id: 4, type: "statistical", facility: "F01", disease: "Measles", period: "2026-06", cases: 18, z: 2.61, k: 2.0, status: "confirmed" },
  { id: 5, type: "non_reporting", facility: "F06", disease: "Measles", period: "2026-08", status: "pending" },
  { id: 6, type: "statistical", facility: "F02", disease: "Cholera", period: "2026-08", cases: 27, z: 2.55, k: 2.0, status: "investigating" },
  { id: 7, type: "statistical", facility: "F07", disease: "Cholera", period: "2026-05", cases: 15, z: 2.08, k: 2.0, status: "false_alarm" },
  { id: 8, type: "statistical", facility: "F03", disease: "Cholera", period: "2026-07", cases: 26, z: 3.1, k: 2.0, status: "confirmed" },
  { id: 9, type: "statistical", facility: "F08", disease: "Measles", period: "2026-08", cases: 20, z: 2.88, k: 2.0, status: "pending" },
  { id: 10, type: "non_reporting", facility: "F09", disease: "Cholera", period: "2026-08", status: "pending" },
  { id: 11, type: "statistical", facility: "F04", disease: "Measles", period: "2026-04", cases: 14, z: 2.55, k: 2.0, status: "closed" },
  { id: 12, type: "statistical", facility: "E01", disease: "Cholera", period: "2026-08", cases: 24, z: 3.61, k: 2.0, status: "pending" },
  { id: 13, type: "statistical", facility: "B01", disease: "Measles", period: "2026-08", cases: 33, z: 3.05, k: 2.0, status: "investigating" },
  { id: 14, type: "statistical", facility: "S01", disease: "Measles", period: "2026-07", cases: 19, z: 2.44, k: 2.0, status: "pending" },
  { id: 15, type: "non_reporting", facility: "K01", disease: "Measles", period: "2026-08", status: "pending" },
  { id: 16, type: "statistical", facility: "N01", disease: "Cholera", period: "2026-08", cases: 52, z: 2.71, k: 2.0, status: "pending" },
  { id: 17, type: "statistical", facility: "O01", disease: "Cholera", period: "2026-06", cases: 17, z: 2.12, k: 2.0, status: "investigating" },
];

export const FLAGS: Flag[] = SEED_FLAGS.map((f) => ({
  ...f,
  state: FACILITY_BY_CODE[f.facility].state,
  lga: FACILITY_BY_CODE[f.facility].lga,
}));

export const FLAG_LOGS: FlagLogEntry[] = [
  { flag: 2, at: "2026-08-03 09:14", actor: "Zaria LGA Officer", from: "pending", to: "investigating", note: "Visiting the facility to verify the line tally against the register." },
  { flag: 4, at: "2026-07-21 11:02", actor: "Zaria LGA Officer", from: "pending", to: "investigating", note: "" },
  { flag: 4, at: "2026-07-22 16:40", actor: "Zaria LGA Supervisor", from: "investigating", to: "confirmed", note: "Six of the eighteen are epi-linked to one ward. Outbreak response team notified." },
  { flag: 6, at: "2026-08-04 08:55", actor: "Sabon Gari LGA Officer", from: "pending", to: "investigating", note: "" },
  { flag: 7, at: "2026-07-15 10:30", actor: "Sabon Gari LGA Officer", from: "pending", to: "investigating", note: "" },
  { flag: 7, at: "2026-07-16 14:12", actor: "Sabon Gari LGA Supervisor", from: "investigating", to: "false_alarm", note: "Duplicate entry — the same 15 cases were reported twice in DHIS2." },
  { flag: 8, at: "2026-08-01 12:20", actor: "Giwa LGA Supervisor", from: "pending", to: "confirmed", note: "Water source implicated; sampling requested from the state lab." },
  { flag: 11, at: "2026-07-08 09:00", actor: "Kudan LGA Officer", from: "pending", to: "investigating", note: "" },
  { flag: 11, at: "2026-07-09 15:33", actor: "Kudan LGA Supervisor", from: "investigating", to: "confirmed", note: "" },
  { flag: 11, at: "2026-07-30 10:05", actor: "Kaduna State Coordinator", from: "confirmed", to: "closed", note: "Response complete, no new cases for three consecutive months." },
  { flag: 13, at: "2026-08-04 07:40", actor: "Borno State Coordinator", from: "pending", to: "investigating", note: "Cross-checking with the IDP camp measles campaign coverage data." },
  { flag: 17, at: "2026-08-02 13:11", actor: "Ondo State Coordinator", from: "pending", to: "investigating", note: "" },
];

const SEED_NOTIFICATIONS: Omit<Notification, "id" | "read">[] = [
  { at: "2026-08-05 06:02", channel: "sms", recipient: "Zaria LGA Supervisor", scope: { state: "Kaduna", lga: "Zaria" }, message: "Unusual rise — Zaria General Hospital (Zaria LGA), Cholera, Aug 2026. 41 cases reported, against a usual level of about 12 a month." },
  { at: "2026-08-05 06:02", channel: "email", recipient: "Kaduna State Coordinator", scope: { state: "Kaduna" }, message: "Unusual rise — Zaria General Hospital (Zaria LGA), Cholera, Aug 2026. 41 cases reported, against a usual level of about 12 a month." },
  { at: "2026-08-05 06:02", channel: "sms", recipient: "Sabon Gari LGA Supervisor", scope: { state: "Kaduna", lga: "Sabon Gari" }, message: "No report — Kongo Clinic (Sabon Gari LGA), Measles, Aug 2026. No case count was received for the expected reporting period." },
  { at: "2026-08-05 06:02", channel: "email", recipient: "NCDC National Coordinator", scope: {}, message: "Unusual rise — Irrua Specialist Hospital (Esan Central LGA, Edo), Cholera, Aug 2026. 24 cases reported, against a usual level of about 8 a month." },
  { at: "2026-08-05 06:02", channel: "sms", recipient: "Edo State Coordinator", scope: { state: "Edo" }, message: "Unusual rise — Irrua Specialist Hospital (Esan Central LGA), Cholera, Aug 2026. 24 cases reported, against a usual level of about 8 a month." },
  { at: "2026-08-04 08:55", channel: "email", recipient: "Kaduna State Coordinator", scope: { state: "Kaduna" }, message: "Status update — Sabon Gari PHC (Sabon Gari LGA), Cholera, Aug 2026. Sabon Gari LGA Officer started an investigation." },
  { at: "2026-08-01 12:20", channel: "sms", recipient: "Kaduna State Coordinator", scope: { state: "Kaduna" }, message: "Status update — Giwa Cottage Hospital (Giwa LGA), Cholera, Jul 2026. Giwa LGA Supervisor confirmed an outbreak." },
];

export const NOTIFICATIONS: Notification[] = SEED_NOTIFICATIONS.map((n, i) => ({
  ...n,
  id: i + 1,
  read: i > 2,
}));

export const ACTIVITY: ActivityEntry[] = [
  { at: "2026-08-05 07:41", actor: "Kaduna State Coordinator", state: "Kaduna", kind: "auth", action: "Signed in", detail: "Session opened from 105.112.x.x" },
  { at: "2026-08-05 06:02", actor: "Detection engine", state: "—", kind: "config", action: "Detection run completed", detail: "240 facility-periods evaluated, 5 new flags raised" },
  { at: "2026-08-04 16:22", actor: "NCDC National Coordinator", state: "—", kind: "config", action: "Alert level changed", detail: "Measles 2.5× → 2.0×" },
  { at: "2026-08-04 15:08", actor: "NCDC National Coordinator", state: "Edo", kind: "account", action: "Account created", detail: "Edo State Coordinator (state.edo@example.org)" },
  { at: "2026-08-04 08:55", actor: "Sabon Gari LGA Officer", state: "Kaduna", kind: "flag", action: "Flag status changed", detail: "Sabon Gari PHC / Cholera 2026-08 → investigating" },
  { at: "2026-08-03 11:47", actor: "Kaduna State Coordinator", state: "Kaduna", kind: "account", action: "Password reset issued", detail: "Kudan LGA Officer — one-time link sent by email" },
  { at: "2026-08-01 12:20", actor: "Giwa LGA Supervisor", state: "Kaduna", kind: "flag", action: "Flag status changed", detail: "Giwa Cottage Hospital / Cholera 2026-07 → confirmed" },
  { at: "2026-07-30 10:05", actor: "Kaduna State Coordinator", state: "Kaduna", kind: "flag", action: "Flag closed", detail: "Kudan PHC / Measles 2026-04 → closed" },
  { at: "2026-07-28 09:14", actor: "NCDC National Coordinator", state: "Borno", kind: "account", action: "Account deactivated", detail: "Former Borno State Coordinator — post handed over" },
].map((a, i) => ({ ...a, id: i + 1 }) as ActivityEntry);

export const THRESHOLDS: DiseaseThreshold[] = [
  { disease: "Cholera", k: 2.0, setBy: "NCDC National Coordinator", setAt: "2026-06-14 09:20" },
  { disease: "Measles", k: 2.0, setBy: "NCDC National Coordinator", setAt: "2026-06-14 09:21" },
];

/**
 * Detector evaluation against the labelled synthetic dataset, as reported in
 * Table 4.1. Nothing on the detector screen is recomputed in the browser.
 */
export const EVALUATION = {
  records: 400,
  seeded: 91,
  scored: 340,
  baselineMonths: 6,
  facilities: 10,
  diseases: 2,
  months: 20,
  lastRun: LAST_DETECTION_RUN,
  sweep: [
    { k: 2.0, tp: 33, fp: 16, fn: 42, tn: 249, selected: true },
    { k: 3.0, tp: 25, fp: 3, fn: 50, tn: 262 },
  ] as DetectorSweepRow[],
};

export const COMPLETENESS: CompletenessRow[] = [
  { facility: "F01", expected: 40, received: 40, missed: 0, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F02", expected: 40, received: 40, missed: 0, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F03", expected: 40, received: 39, missed: 1, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F04", expected: 40, received: 40, missed: 0, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F05", expected: 40, received: 40, missed: 0, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F06", expected: 40, received: 38, missed: 2, silentMonths: 1, lastPeriod: "2026-07" },
  { facility: "F07", expected: 40, received: 37, missed: 3, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F08", expected: 40, received: 40, missed: 0, silentMonths: 0, lastPeriod: "2026-08" },
  { facility: "F09", expected: 40, received: 37, missed: 3, silentMonths: 2, lastPeriod: "2026-06" },
  { facility: "F10", expected: 40, received: 39, missed: 1, silentMonths: 1, lastPeriod: "2026-07" },
];

export const INGEST_RUNS: IngestRun[] = [
  { at: "2026-08-05 06:00", status: "ok", orgUnits: 10, dataElements: 2, periods: 1, records: 20, durationMs: 1840, note: "Monthly pull, August 2026. Detection ran on completion." },
  { at: "2026-07-29 06:00", status: "ok", orgUnits: 10, dataElements: 2, periods: 1, records: 20, durationMs: 1610, note: "" },
  { at: "2026-07-22 06:00", status: "warn", orgUnits: 10, dataElements: 2, periods: 1, records: 18, durationMs: 2270, note: "2 facilities returned no data — passed to the reporting-completeness check." },
  { at: "2026-07-15 06:00", status: "fail", orgUnits: 0, dataElements: 0, periods: 0, records: 0, durationMs: 30000, note: "HTTP 504 from the DHIS2 endpoint after 30s. Retried automatically at 06:15 and succeeded." },
  { at: "2026-07-08 06:00", status: "ok", orgUnits: 10, dataElements: 2, periods: 1, records: 20, durationMs: 1720, note: "" },
];

export const ACCOUNTS: AccountRecord[] = [
  { name: "NCDC National Coordinator", role: "national", state: "—", lga: "—", phone: "+2348000000001", email: "national@ncdc.example.org" },
  { name: "NCDC Systems Administrator", role: "sysadmin", state: "—", lga: "—", phone: "", email: "sysadmin@ncdc.example.org" },
  { name: "Kaduna State Coordinator", role: "state", state: "Kaduna", lga: "—", phone: "+2348000000002", email: "state.kaduna@example.org" },
  { name: "Edo State Coordinator", role: "state", state: "Edo", lga: "—", phone: "+2348000000003", email: "state.edo@example.org" },
  { name: "Borno State Coordinator", role: "state", state: "Borno", lga: "—", phone: "+2348000000004", email: "state.borno@example.org" },
  { name: "Zaria LGA Supervisor", role: "supervisor", state: "Kaduna", lga: "Zaria", phone: "+2348000000014", email: "supervisor.zaria@example.org" },
  { name: "Sabon Gari LGA Supervisor", role: "supervisor", state: "Kaduna", lga: "Sabon Gari", phone: "+2348000000015", email: "supervisor.sabongari@example.org" },
  { name: "Giwa LGA Supervisor", role: "supervisor", state: "Kaduna", lga: "Giwa", phone: "+2348000000016", email: "supervisor.giwa@example.org" },
  { name: "Kudan LGA Supervisor", role: "supervisor", state: "Kaduna", lga: "Kudan", phone: "+2348000000017", email: "supervisor.kudan@example.org" },
  { name: "Zaria LGA Officer", role: "officer", state: "Kaduna", lga: "Zaria", phone: "+2348000000024", email: "officer.zaria@example.org" },
  { name: "Sabon Gari LGA Officer", role: "officer", state: "Kaduna", lga: "Sabon Gari", phone: "", email: "officer.sabongari@example.org" },
  { name: "Giwa LGA Officer", role: "officer", state: "Kaduna", lga: "Giwa", phone: "+2348000000026", email: "officer.giwa@example.org" },
  { name: "Kudan LGA Officer", role: "officer", state: "Kaduna", lga: "Kudan", phone: "", email: "officer.kudan@example.org" },
  { name: "Ikara LGA Officer", role: "officer", state: "Kaduna", lga: "Ikara", phone: "+2348000000027", email: "officer.ikara@example.org", active: false, note: "Deactivated 12 July — transferred to Kano State" },
].map((u, i) => ({ active: true, ...u, id: i + 1 }) as AccountRecord);

export const DHIS2_CONNECTION = {
  endpoint: "https://play.dhis2.org/api/dataValueSets",
  auth: "Stored on the server and never shown in the browser",
  orgUnits: "10 facilities under Kaduna State",
  dataElements: "Cholera cases, Measles cases (monthly aggregate)",
  schedule: "Monthly, 5th of the month at 06:00 WAT, followed immediately by a detection run",
  onFailure: "One automatic retry after 15 minutes, then an alert to the national coordinator",
};
