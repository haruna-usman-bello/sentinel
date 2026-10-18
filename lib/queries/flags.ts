import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { BASELINE_MONTHS, baselineOf } from "@/lib/detector/core";
import { isFinding, monthsBefore } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import type { TrendPoint } from "@/components/dashboard/case-trend-chart";
import type {
  Escalation,
  EscalationTargets,
  Flag,
  FlagLogEntry,
  FlagStatus,
  Scope,
} from "@/lib/types";

import { facilityScope, formatStamp } from "./shared";

const flagInclude = {
  facility: { select: { id: true, code: true, name: true, lgaName: true, stateName: true } },
  disease: { select: { id: true, name: true } },
} satisfies Prisma.FlagInclude;

type FlagRow = Prisma.FlagGetPayload<{ include: typeof flagInclude }>;

/** Newest signal first: the current month, strongest rise at the top. */
const flagOrder: Prisma.FlagOrderByWithRelationInput[] = [
  { period: "desc" },
  { zScore: { sort: "desc", nulls: "last" } },
  { raisedAt: "desc" },
];

/**
 * Everyone a flag could escalate to. The set is small — one coordinator per
 * state, one supervisor per LGA, one national — and it does not depend on
 * which flags came back, so it is fetched alongside them rather than after
 * them. On a distant database that is one round trip saved on every screen
 * that lists a flag.
 */
async function escalationContacts() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["supervisor", "state", "national"] } },
    select: { name: true, phone: true, role: true, stateName: true, lgaName: true },
    orderBy: { createdAt: "asc" },
  });
}

type Contact = Awaited<ReturnType<typeof escalationContacts>>[number];

/** Resolves the posts a given flag escalates to, from the contacts already in hand. */
function escalationResolver(users: Contact[]): (row: FlagRow) => EscalationTargets {
  const contact = (u: Contact | undefined): Escalation | null =>
    u ? { name: u.name, channel: u.phone ? "sms" : "email" } : null;

  const national = contact(users.find((u) => u.role === "national"));
  const byState = new Map<string, Escalation | null>();
  const byLga = new Map<string, Escalation | null>();

  return (row) => {
    const { stateName, lgaName } = row.facility;
    const lgaKey = `${stateName}\u0000${lgaName}`;
    if (!byState.has(stateName)) {
      byState.set(
        stateName,
        contact(users.find((u) => u.role === "state" && u.stateName === stateName)),
      );
    }
    if (!byLga.has(lgaKey)) {
      byLga.set(
        lgaKey,
        contact(
          users.find(
            (u) => u.role === "supervisor" && u.stateName === stateName && u.lgaName === lgaName,
          ),
        ),
      );
    }
    return { supervisor: byLga.get(lgaKey)!, stateCoordinator: byState.get(stateName)!, national };
  };
}

function toFlag(row: FlagRow, escalation: (row: FlagRow) => EscalationTargets): Flag {
  return {
    id: row.id,
    type: row.type,
    facility: row.facility.code,
    facilityName: row.facility.name,
    disease: row.disease.name,
    period: row.period,
    status: row.status,
    cases: row.cases ?? undefined,
    z: row.zScore ?? undefined,
    k: row.thresholdK ?? undefined,
    state: row.facility.stateName,
    lga: row.facility.lgaName,
    raisedAt: formatStamp(row.raisedAt),
    escalation: escalation(row),
  };
}

/**
 * Every flag the scope may see, as the system stood at the end of `period`:
 * a flag raised for a later month is not yet in view.
 */
export async function listFlags(scope: Scope, period: string): Promise<Flag[]> {
  const facility = facilityScope(scope);
  if (!facility) return [];
  const [rows, contacts] = await Promise.all([
    prisma.flag.findMany({
      where: { facility, period: { lte: period } },
      include: flagInclude,
      orderBy: flagOrder,
    }),
    escalationContacts(),
  ]);
  const escalation = escalationResolver(contacts);
  return rows.map((row) => toFlag(row, escalation));
}

/** One flag, or null when it does not exist or lies outside the scope. */
export async function getFlag(id: string, scope: Scope): Promise<Flag | null> {
  const facility = facilityScope(scope);
  if (!facility) return null;
  const [row, contacts] = await Promise.all([
    prisma.flag.findFirst({ where: { id, facility }, include: flagInclude }),
    escalationContacts(),
  ]);
  if (!row) return null;
  return toFlag(row, escalationResolver(contacts));
}

/** Every flag on the same facility and disease as `flag`, across all periods. */
export async function siblingFlags(flag: Flag): Promise<Flag[]> {
  const [rows, contacts] = await Promise.all([
    prisma.flag.findMany({
      where: { facility: { code: flag.facility }, disease: { name: flag.disease } },
      include: flagInclude,
      orderBy: flagOrder,
    }),
    escalationContacts(),
  ]);
  const escalation = escalationResolver(contacts);
  return rows.map((row) => toFlag(row, escalation));
}

function toLogEntry(r: Prisma.FlagLogGetPayload<object>): FlagLogEntry {
  return {
    id: r.id,
    flag: r.flagId,
    at: formatStamp(r.at),
    actor: r.actorName,
    from: r.fromStatus,
    to: r.toStatus,
    note: r.note ?? "",
  };
}

/** The audit trail of one flag, oldest entry first. */
export async function flagLogs(flagId: string): Promise<FlagLogEntry[]> {
  const rows = await prisma.flagLog.findMany({
    where: { flagId },
    orderBy: { at: "asc" },
  });
  return rows.map(toLogEntry);
}

export interface FlagTrail {
  /** The latest finding the officer recorded, if any. */
  lastFinding: FlagLogEntry | null;
  /** The entry that put a decided flag where it is now. */
  decision: FlagLogEntry | null;
}

const DECIDED: FlagStatus[] = ["confirmed", "false_alarm", "closed"];

/** What the worklist says under each card: its latest finding, or who decided it and when. */
export async function flagTrails(flags: Flag[]): Promise<Map<string, FlagTrail>> {
  const trails = new Map<string, FlagTrail>(
    flags.map((f) => [f.id, { lastFinding: null, decision: null }]),
  );
  if (!flags.length) return trails;
  const status = new Map(flags.map((f) => [f.id, f.status]));
  const rows = await prisma.flagLog.findMany({
    where: { flagId: { in: flags.map((f) => f.id) } },
    orderBy: { at: "asc" },
  });
  for (const row of rows) {
    const entry = toLogEntry(row);
    const trail = trails.get(row.flagId)!;
    if (isFinding(entry)) trail.lastFinding = entry;
    else if (DECIDED.includes(entry.to) && entry.to === status.get(row.flagId)) trail.decision = entry;
  }
  return trails;
}

/**
 * Each rise's usual monthly count: the mean of what the facility reported for
 * that disease over the six months before, as the detector's alert quotes it.
 * Keyed by flag id; a rise with nothing reported before it is left out.
 */
export async function usualLevels(flags: Flag[]): Promise<Map<string, number>> {
  const rises = flags.filter((f) => f.type === "statistical");
  if (!rises.length) return new Map();
  const windows = new Map(rises.map((f) => [f.id, monthsBefore(f.period, BASELINE_MONTHS)]));
  const rows = await prisma.caseReport.findMany({
    where: {
      facility: { code: { in: [...new Set(rises.map((f) => f.facility))] } },
      disease: { name: { in: [...new Set(rises.map((f) => f.disease))] } },
      period: { gte: [...windows.values()].map((w) => w[0]).sort()[0] },
    },
    select: { period: true, count: true, facility: { select: { code: true } }, disease: { select: { name: true } } },
  });
  const counts = new Map(rows.map((r) => [`${r.facility.code}/${r.disease.name}/${r.period}`, r.count]));
  const levels = new Map<string, number>();
  for (const f of rises) {
    const baseline = baselineOf(windows.get(f.id)!.map((p) => counts.get(`${f.facility}/${f.disease}/${p}`)));
    if (baseline.reports) levels.set(f.id, baseline.mean);
  }
  return levels;
}

export interface ConfirmedOutbreak {
  flag: Flag;
  /** The note that went with the confirmation, or with the close if that is all there is. */
  note: string;
  /** "YYYY-MM-DD" when the flag has since been closed. */
  closedOn: string | null;
}

/**
 * Everything the scope has declared an outbreak up to `period`, newest first,
 * including flags that have since been closed.
 */
/** @param limit how many to return, most recent first; null for all of them. */
export async function confirmedOutbreaks(
  scope: Scope,
  period: string,
  limit: number | null = 5,
): Promise<ConfirmedOutbreak[]> {
  const facility = facilityScope(scope);
  if (!facility) return [];
  const [rows, contacts] = await Promise.all([
    prisma.flag.findMany({
      where: {
        facility,
        period: { lte: period },
        OR: [{ status: "confirmed" }, { status: "closed", logs: { some: { toStatus: "confirmed" } } }],
      },
      include: { ...flagInclude, logs: { orderBy: { at: "asc" } } },
      orderBy: [{ period: "desc" }, { raisedAt: "desc" }],
      take: limit ?? undefined,
    }),
    escalationContacts(),
  ]);
  const escalation = escalationResolver(contacts);
  return rows.map((row) => {
    const confirmed = row.logs.find((l) => l.toStatus === "confirmed");
    const closed = row.logs.find((l) => l.toStatus === "closed");
    return {
      flag: toFlag(row, escalation),
      note: confirmed?.note || closed?.note || "",
      closedOn: closed ? formatStamp(closed.at).slice(0, 10) : null,
    };
  });
}

/** Monthly case counts for one facility and disease, oldest first; null where nothing arrived. */
export async function caseSeriesFor(facilityCode: string, disease: string): Promise<TrendPoint[]> {
  const rows = await prisma.caseReport.findMany({
    where: { facility: { code: facilityCode }, disease: { name: disease } },
    select: { period: true, count: true },
    orderBy: { period: "asc" },
  });
  return rows.map((r) => ({ period: r.period, count: r.count }));
}

/** Alert level in force for a disease. */
/**
 * Flags in the scope with one of `statuses` — still open, by default — for the
 * sidebar badge. No period filter: a flag is only ever raised for a month that
 * has case data, so every flag falls on or before the current period by
 * construction, and asking for the period first would make the sidebar wait
 * on a query it does not need.
 */
export async function countOpenFlags(
  scope: Scope,
  statuses: FlagStatus[] = ["pending", "investigating"],
): Promise<number> {
  const facility = facilityScope(scope);
  if (!facility) return 0;
  return prisma.flag.count({ where: { facility, status: { in: statuses } } });
}

/** How many statistical flags each disease has ever raised — the thresholds screen's "flags raised" column. */
export async function countStatisticalFlagsByDisease(): Promise<Record<string, number>> {
  const rows = await prisma.flag.groupBy({
    by: ["diseaseId"],
    where: { type: "statistical" },
    _count: { _all: true },
  });
  const diseases = await prisma.disease.findMany({ select: { id: true, name: true } });
  const nameById = new Map(diseases.map((d) => [d.id, d.name]));
  return Object.fromEntries(rows.map((r) => [nameById.get(r.diseaseId) ?? r.diseaseId, r._count._all]));
}
