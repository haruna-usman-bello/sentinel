import type { FlagStatus, Role, RoleDefinition } from "@/lib/types";

const NO_TRANSITIONS: Record<FlagStatus, FlagStatus[]> = {
  pending: [],
  investigating: [],
  confirmed: [],
  false_alarm: [],
  closed: [],
};

/** Everything above Tier 1 adjudicates; only the officer is limited to opening one. */
const ADJUDICATOR: Record<FlagStatus, FlagStatus[]> = {
  pending: ["investigating", "confirmed", "false_alarm"],
  investigating: ["confirmed", "false_alarm"],
  confirmed: ["closed"],
  false_alarm: ["closed"],
  closed: [],
};

export const ROLES: Record<Role, RoleDefinition> = {
  officer: {
    key: "officer",
    tier: "Tier 1",
    label: "Surveillance Officer",
    who: "Zaria LGA Officer",
    email: "officer.zaria@example.org",
    scope: { state: "Kaduna", lga: "Zaria" },
    scopeLabel: "Zaria LGA · Kaduna",
    blurb: "Triages the flags raised in one LGA and opens investigations.",
    home: "/worklist",
    nav: [
      { href: "/worklist", label: "My worklist", badge: "open" },
      { href: "/notifications", label: "Alerts I received", badge: "notifications" },
    ],
    can: { ...NO_TRANSITIONS, pending: ["investigating"] },
  },
  supervisor: {
    key: "supervisor",
    tier: "Tier 2",
    label: "LGA Supervisor",
    who: "Zaria LGA Supervisor",
    email: "supervisor.zaria@example.org",
    scope: { state: "Kaduna", lga: "Zaria" },
    scopeLabel: "Zaria LGA · Kaduna",
    blurb: "Adjudicates the officer's findings — confirms, dismisses or closes a flag.",
    home: "/queue",
    nav: [
      { href: "/queue", label: "Review queue", badge: "open" },
      { href: "/map", label: "LGA map" },
      { href: "/completeness", label: "Reporting completeness" },
      { href: "/notifications", label: "Notifications", badge: "notifications" },
    ],
    can: ADJUDICATOR,
  },
  state: {
    key: "state",
    tier: "Tier 3",
    label: "State Coordinator",
    who: "Kaduna State Coordinator",
    email: "state.kaduna@example.org",
    scope: { state: "Kaduna" },
    scopeLabel: "Kaduna State · 4 LGAs",
    blurb: "Watches every LGA in one state and files the monthly situation report.",
    home: "/state",
    nav: [
      { href: "/state", label: "State dashboard" },
      { href: "/flags", label: "All flags", badge: "open" },
      { href: "/map", label: "Facility map" },
      { href: "/completeness", label: "Reporting completeness" },
      { href: "/notifications", label: "Notifications", badge: "notifications" },
      { href: "/export", label: "Situation report" },
    ],
    can: ADJUDICATOR,
  },
  national: {
    key: "national",
    tier: "Tier 4",
    label: "National Coordinator",
    who: "NCDC National Coordinator",
    email: "national@ncdc.example.org",
    scope: {},
    scopeLabel: "National · 36 states + FCT",
    blurb: "Sees the whole country, sets detection thresholds, manages every account.",
    home: "/national",
    nav: [
      { href: "/national", label: "National summary" },
      { href: "/national/map", label: "National map" },
      { href: "/flags", label: "All flags", badge: "open" },
      { href: "/completeness", label: "Reporting completeness" },
      { href: "/notifications", label: "Notifications", badge: "notifications" },
      { href: "/thresholds", label: "Alert levels" },
      { href: "/detector", label: "Detector accuracy" },
      { href: "/export", label: "Situation report" },
    ],
    can: ADJUDICATOR,
  },
  /**
   * Separation of duties: the administrator runs the system and can see no case
   * data at all, so whoever holds the DHIS2 credentials is never the person who
   * decides whether an outbreak is real.
   */
  sysadmin: {
    key: "sysadmin",
    tier: "Technical",
    label: "System Administrator",
    who: "NCDC Systems Administrator",
    email: "sysadmin@ncdc.example.org",
    scope: { none: true },
    scopeLabel: "Administration · no case data",
    blurb:
      "Runs the system rather than the surveillance: accounts, the DHIS2 connection, the activity log.",
    home: "/users",
    nav: [
      { href: "/users", label: "User management" },
      { href: "/ingest", label: "DHIS2 ingestion" },
      { href: "/activity", label: "System activity" },
    ],
    can: NO_TRANSITIONS,
  },
};

export const ROLE_LIST = Object.values(ROLES);

export function roleByEmail(email: string): RoleDefinition | undefined {
  const needle = email.trim().toLowerCase();
  return ROLE_LIST.find((r) => r.email.toLowerCase() === needle);
}

export function isRole(value: string | undefined): value is Role {
  return !!value && value in ROLES;
}
