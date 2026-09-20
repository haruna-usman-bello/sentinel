import type {
  FlagStatus,
  Role,
  RoleDefinition,
  Scope,
  SessionUser,
} from "@/lib/types";

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

export function isRole(value: string | undefined): value is Role {
  return !!value && value in ROLES;
}

/** The slice of the country a user may see, derived from their tier and posting. */
export function scopeOf(user: Pick<SessionUser, "role" | "state" | "lga">): Scope {
  switch (user.role) {
    case "sysadmin":
      return { none: true };
    case "national":
      return {};
    case "state":
      return { state: user.state };
    case "supervisor":
    case "officer":
      return { state: user.state, lga: user.lga };
  }
}

/**
 * @param lgaCount how many LGAs report from the user's state — only a state
 *   coordinator's label mentions it, and only the database knows it.
 */
export function scopeLabelOf(
  user: Pick<SessionUser, "role" | "state" | "lga">,
  lgaCount = 0,
): string {
  switch (user.role) {
    case "sysadmin":
      return "Administration · no case data";
    case "national":
      return "National · 36 states + FCT";
    case "state":
      return `${user.state} State · ${lgaCount} LGA${lgaCount === 1 ? "" : "s"}`;
    case "supervisor":
    case "officer":
      return `${user.lga} LGA · ${user.state}`;
  }
}
