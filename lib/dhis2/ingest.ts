import "server-only";

import { dispatchPending } from "@/lib/alerts/dispatch";
import { fromDhis2Period, toDhis2Period } from "@/lib/detector/core";
import { runDetection, type DetectionSummary } from "@/lib/detector/run";
import type { IngestStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { Dhis2Error, liveTransport, type Dhis2Transport } from "./client";
import { dhis2Configured } from "./config";

export interface IngestSummary {
  period: string;
  status: IngestStatus;
  records: number;
  orgUnits: number;
  dataElements: number;
  durationMs: number;
  note: string;
  detection: DetectionSummary | null;
  /** Alerts delivered on this run, including ones left over from earlier. */
  alerts: { sent: number; failed: number; skipped: number } | null;
}

/**
 * One scheduled cycle: pull a month's case counts from DHIS2, record the
 * pull, then run detection on what is now held. Without a live instance the
 * pull is skipped and recorded as such, and detection still runs — the
 * reference dataset stands in for the feed, not for the detector.
 *
 * A facility and disease that have reported before but returned nothing
 * this month get a null count, which is what the non-reporting rule reads.
 */
export async function runIngestion(options: {
  period?: string;
  transport?: Dhis2Transport;
} = {}): Promise<IngestSummary> {
  const started = Date.now();
  const period = options.period ?? (await latestPeriod());
  const transport = options.transport ?? (dhis2Configured() ? liveTransport() : null);

  if (!transport) {
    const records = await prisma.caseReport.count({ where: { period } });
    const detection = await runDetection(period);
    const alerts = await deliver();
    return finish({
      period,
      status: "warn",
      records,
      orgUnits: 0,
      dataElements: 0,
      durationMs: Date.now() - started,
      note: `Live DHIS2 unavailable — nothing pulled; detection re-ran on the ${records} records already held for ${period}.`,
      detection,
      alerts,
    });
  }

  const [facilities, diseases] = await Promise.all([
    prisma.facility.findMany({
      where: { dhis2OrgUnit: { not: null } },
      select: { id: true, dhis2OrgUnit: true },
    }),
    prisma.disease.findMany({
      where: { dhis2DataElement: { not: null } },
      select: { id: true, dhis2DataElement: true },
    }),
  ]);
  const facilityByOrgUnit = new Map(facilities.map((f) => [f.dhis2OrgUnit!, f.id]));
  const diseaseByElement = new Map(diseases.map((d) => [d.dhis2DataElement!, d.id]));

  let values;
  try {
    values = await transport.fetchDataValueSet({
      orgUnits: [...facilityByOrgUnit.keys()],
      dataElements: [...diseaseByElement.keys()],
      period: toDhis2Period(period),
    });
  } catch (error) {
    const note =
      error instanceof Dhis2Error
        ? `${error.message}. Nothing was changed; detection did not run.`
        : `Pull failed: ${(error as Error).message}. Nothing was changed; detection did not run.`;
    return finish({
      period,
      status: "fail",
      records: 0,
      orgUnits: facilities.length,
      dataElements: diseases.length,
      durationMs: Date.now() - started,
      note,
      detection: null,
      alerts: null,
    });
  }

  // Pairs expected to report: anything that has reported before.
  const reporting = await prisma.caseReport.findMany({
    where: { facilityId: { in: facilities.map((f) => f.id) } },
    distinct: ["facilityId", "diseaseId"],
    select: { facilityId: true, diseaseId: true },
  });
  const expected = new Set(reporting.map((r) => `${r.facilityId}/${r.diseaseId}`));

  const received = new Map<string, number>();
  for (const v of values) {
    const facilityId = facilityByOrgUnit.get(v.orgUnit);
    const diseaseId = diseaseByElement.get(v.dataElement);
    if (!facilityId || !diseaseId || fromDhis2Period(v.period) !== period) continue;
    const count = Number.parseInt(v.value, 10);
    if (Number.isNaN(count)) continue;
    received.set(`${facilityId}/${diseaseId}`, count);
  }

  const upserts = [...new Set([...expected, ...received.keys()])].map((key) => {
    const [facilityId, diseaseId] = key.split("/");
    const count = received.get(key) ?? null;
    return prisma.caseReport.upsert({
      where: { facilityId_diseaseId_period: { facilityId, diseaseId, period } },
      create: { facilityId, diseaseId, period, count },
      update: { count, ingestedAt: new Date() },
    });
  });
  await prisma.$transaction(upserts);

  const silent = [...expected].filter((key) => !received.has(key)).length;
  const detection = await runDetection(period);
  const alerts = await deliver();

  return finish({
    period,
    status: silent ? "warn" : "ok",
    records: received.size,
    orgUnits: facilities.length,
    dataElements: diseases.length,
    durationMs: Date.now() - started,
    note: silent
      ? `${silent} facility-disease pair${silent === 1 ? "" : "s"} returned no data — passed to the reporting-completeness check. Detection raised ${detection.raised} new flag${detection.raised === 1 ? "" : "s"}.`
      : `Monthly pull, ${period}. Detection ran on completion and raised ${detection.raised} new flag${detection.raised === 1 ? "" : "s"}.`,
    detection,
    alerts,
  });
}

/**
 * Sends whatever is waiting, new or left over. The scheduled cycle is the
 * retry for an alert that could not go out when it was raised, which is why
 * it is worth running even in a month when DHIS2 offers nothing new.
 */
async function deliver() {
  const summary = await dispatchPending();
  return { sent: summary.sent, failed: summary.failed, skipped: summary.skipped };
}

async function latestPeriod(): Promise<string> {
  const row = await prisma.caseReport.findFirst({
    orderBy: { period: "desc" },
    select: { period: true },
  });
  return row?.period ?? new Date().toISOString().slice(0, 7);
}

async function finish(summary: IngestSummary): Promise<IngestSummary> {
  await prisma.ingestRun.create({
    data: {
      status: summary.status,
      orgUnits: summary.orgUnits,
      dataElements: summary.dataElements,
      periods: 1,
      records: summary.records,
      durationMs: summary.durationMs,
      note: summary.note,
    },
  });
  return summary;
}
