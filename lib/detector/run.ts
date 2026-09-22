import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { monthLabel } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

import { BASELINE_MONTHS, completenessOf, evaluateMonth } from "./core";

export interface DetectionSummary {
  period: string;
  evaluated: number;
  raised: number;
  /** Facility code / disease of every flag raised this run. */
  flags: { facility: string; disease: string; type: "statistical" | "non_reporting" }[];
}

/**
 * Scores one reporting month for every facility and disease, raises the
 * flags that are due, notifies the people responsible and refreshes each
 * facility's reporting record. Re-running for the same month is safe: a
 * flag that already exists for a facility, disease, month and type is left
 * exactly as it is, decisions and all.
 */
export async function runDetection(period: string): Promise<DetectionSummary> {
  const [diseases, facilities, periods] = await Promise.all([
    prisma.disease.findMany({ select: { id: true, name: true, alertLevelK: true } }),
    prisma.facility.findMany({
      select: { id: true, code: true, name: true, lgaName: true, stateName: true },
    }),
    prisma.caseReport.findMany({
      distinct: ["period"],
      select: { period: true },
      where: { period: { lte: period } },
      orderBy: { period: "asc" },
    }),
  ]);
  const months = periods.map((p) => p.period);
  if (!months.includes(period)) months.push(period);

  const reports = await prisma.caseReport.findMany({
    where: { period: { lte: period } },
    select: { facilityId: true, diseaseId: true, period: true, count: true },
  });
  // facility → disease → period → count
  const table = new Map<string, Map<string, Map<string, number | null>>>();
  for (const r of reports) {
    let byDisease = table.get(r.facilityId);
    if (!byDisease) table.set(r.facilityId, (byDisease = new Map()));
    let byPeriod = byDisease.get(r.diseaseId);
    if (!byPeriod) byDisease.set(r.diseaseId, (byPeriod = new Map()));
    byPeriod.set(r.period, r.count);
  }

  const existing = await prisma.flag.findMany({
    where: { period },
    select: { facilityId: true, diseaseId: true, type: true },
  });
  const already = new Set(existing.map((f) => `${f.facilityId}/${f.diseaseId}/${f.type}`));

  const creates: Prisma.FlagCreateManyInput[] = [];
  const summary: DetectionSummary = { period, evaluated: 0, raised: 0, flags: [] };
  const completeness: Prisma.ReportingCompletenessCreateManyInput[] = [];

  for (const facility of facilities) {
    const byDisease = table.get(facility.id);
    if (!byDisease) continue;

    const seriesByDisease: Record<string, (number | null)[]> = {};
    for (const disease of diseases) {
      const byPeriod = byDisease.get(disease.id);
      if (!byPeriod) continue; // this facility does not report on this disease
      const series = months.map((m) => (byPeriod.has(m) ? byPeriod.get(m)! : null));
      seriesByDisease[disease.name] = series;

      // Evaluate the month in question against everything before it.
      const upTo = series.slice(0, months.indexOf(period) + 1);
      summary.evaluated++;
      const verdict = evaluateMonth(upTo, disease.alertLevelK);
      if (verdict.kind !== "statistical" && verdict.kind !== "non_reporting") continue;
      if (already.has(`${facility.id}/${disease.id}/${verdict.kind}`)) continue;

      creates.push({
        type: verdict.kind,
        facilityId: facility.id,
        diseaseId: disease.id,
        period,
        cases: verdict.kind === "statistical" ? verdict.cases : null,
        zScore: verdict.kind === "statistical" ? round(verdict.z, 2) : null,
        thresholdK: verdict.kind === "statistical" ? disease.alertLevelK : null,
      });
      summary.flags.push({ facility: facility.code, disease: disease.name, type: verdict.kind });
    }

    const record = completenessOf(months, seriesByDisease);
    completeness.push({
      facilityId: facility.id,
      expected: record.expected,
      received: record.received,
      missed: record.missed,
      silentMonths: record.silentMonths,
      lastPeriod: record.lastPeriod ?? period,
    });
  }

  const notifications = await notificationsFor(creates, facilities, diseases, table, months);
  summary.raised = creates.length;

  await prisma.$transaction([
    ...(creates.length ? [prisma.flag.createMany({ data: creates })] : []),
    ...(notifications.length ? [prisma.notification.createMany({ data: notifications })] : []),
    prisma.reportingCompleteness.deleteMany({}),
    ...(completeness.length ? [prisma.reportingCompleteness.createMany({ data: completeness })] : []),
    prisma.activityLog.create({
      data: {
        actorName: "Detection engine",
        stateName: null,
        kind: "config",
        action: "Detection run completed",
        detail: `${summary.evaluated} facility-periods evaluated, ${summary.raised} new flag${summary.raised === 1 ? "" : "s"} raised`,
      },
    }),
  ]);

  return summary;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

type FacilityRow = { id: string; code: string; name: string; lgaName: string; stateName: string };
type DiseaseRow = { id: string; name: string; alertLevelK: number };

/**
 * A new flag is sent to the LGA's supervisor and the state's coordinator.
 * When no active supervisor covers the LGA the national coordinator is told
 * instead, so no signal waits on an empty post.
 */
async function notificationsFor(
  creates: Prisma.FlagCreateManyInput[],
  facilities: FacilityRow[],
  diseases: DiseaseRow[],
  table: Map<string, Map<string, Map<string, number | null>>>,
  months: string[],
): Promise<Prisma.NotificationCreateManyInput[]> {
  if (!creates.length) return [];
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["supervisor", "state", "national"] } },
    select: { id: true, name: true, role: true, phone: true, stateName: true, lgaName: true },
    orderBy: { createdAt: "asc" },
  });

  const out: Prisma.NotificationCreateManyInput[] = [];
  for (const flag of creates) {
    const facility = facilities.find((f) => f.id === flag.facilityId)!;
    const disease = diseases.find((d) => d.id === flag.diseaseId)!;
    const message = messageFor(flag, facility, disease, table, months);

    const supervisor = users.find(
      (u) => u.role === "supervisor" && u.stateName === facility.stateName && u.lgaName === facility.lgaName,
    );
    const coordinator = users.find((u) => u.role === "state" && u.stateName === facility.stateName);
    const national = users.find((u) => u.role === "national");

    const recipients = [
      supervisor ?? national,
      coordinator,
    ].filter((u): u is NonNullable<typeof u> => !!u);

    for (const u of recipients) {
      out.push({
        channel: u.phone ? "sms" : "email",
        recipientId: u.id,
        recipientName: u.name,
        scopeState: u.role === "national" ? null : facility.stateName,
        scopeLga: u.role === "supervisor" ? facility.lgaName : null,
        message,
      });
    }
  }
  return out;
}

function messageFor(
  flag: Prisma.FlagCreateManyInput,
  facility: FacilityRow,
  disease: DiseaseRow,
  table: Map<string, Map<string, Map<string, number | null>>>,
  months: string[],
): string {
  const where = `${facility.name} (${facility.lgaName} LGA)`;
  const when = monthLabel(flag.period);
  if (flag.type === "non_reporting") {
    return `No report — ${where}, ${disease.name}, ${when}. No case count was received for the expected reporting period.`;
  }
  const byPeriod = table.get(facility.id)?.get(disease.id);
  const index = months.indexOf(flag.period);
  const recent = months
    .slice(Math.max(0, index - BASELINE_MONTHS), index)
    .map((m) => byPeriod?.get(m) ?? null)
    .filter((v): v is number => v !== null);
  const usual = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
  return `Unusual rise — ${where}, ${disease.name}, ${when}. ${flag.cases} cases reported, against a usual level of about ${usual} a month.`;
}
