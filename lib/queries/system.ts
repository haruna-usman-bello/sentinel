import "server-only";

import { DHIS2_ON_FAILURE, DHIS2_SCHEDULE, dhis2Config, dhis2Configured } from "@/lib/dhis2/config";
import { prisma } from "@/lib/prisma";
import type {
  CompletenessRow,
  DetectorSweepRow,
  DiseaseThreshold,
  IngestRun,
  Scope,
} from "@/lib/types";

import { facilityScope, formatStamp } from "./shared";

/** The alert level in force for each disease, and who set it. */
export async function listThresholds(): Promise<DiseaseThreshold[]> {
  const rows = await prisma.disease.findMany({
    select: { name: true, alertLevelK: true, setAt: true, setBy: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((d) => ({
    disease: d.name,
    k: d.alertLevelK,
    setBy: d.setBy?.name ?? "—",
    setAt: formatStamp(d.setAt),
  }));
}

export interface DetectorEvaluation {
  records: number;
  seeded: number;
  baselineMonths: number;
  sweep: DetectorSweepRow[];
}

/** Every alert level the detector has been evaluated at, with the one in use marked. */
export async function detectorEvaluation(): Promise<DetectorEvaluation | null> {
  const rows = await prisma.detectorSweep.findMany({ orderBy: { alertLevelK: "asc" } });
  if (!rows.length) return null;
  const selected = rows.find((r) => r.selected) ?? rows[0];
  return {
    records: selected.records,
    seeded: selected.seeded,
    baselineMonths: selected.baselineMonths,
    sweep: rows.map((r) => ({
      k: r.alertLevelK,
      tp: r.truePositives,
      fp: r.falsePositives,
      fn: r.falseNegatives,
      tn: r.trueNegatives,
      selected: r.selected,
    })),
  };
}

export interface CompletenessEntry extends CompletenessRow {
  facilityName: string;
  lga: string;
}

/** Each facility's reporting record in scope, the quietest first. */
export async function listCompleteness(scope: Scope): Promise<CompletenessEntry[]> {
  const facility = facilityScope(scope);
  if (!facility) return [];
  const rows = await prisma.reportingCompleteness.findMany({
    where: { facility },
    include: { facility: { select: { code: true, name: true, lgaName: true } } },
  });
  return rows
    .map((r) => ({
      facility: r.facility.code,
      facilityName: r.facility.name,
      lga: r.facility.lgaName,
      expected: r.expected,
      received: r.received,
      missed: r.missed,
      silentMonths: r.silentMonths,
      lastPeriod: r.lastPeriod,
    }))
    .sort(
      (a, b) =>
        b.silentMonths - a.silentMonths ||
        a.received / a.expected - b.received / b.expected,
    );
}

export async function listIngestRuns(limit = 5): Promise<IngestRun[]> {
  const rows = await prisma.ingestRun.findMany({ orderBy: { at: "desc" }, take: limit });
  return rows.map((r) => ({
    at: formatStamp(r.at),
    status: r.status,
    orgUnits: r.orgUnits,
    dataElements: r.dataElements,
    periods: r.periods,
    records: r.records,
    durationMs: r.durationMs,
    note: r.note ?? "",
  }));
}

export interface IngestionOverview {
  /** The endpoint address, or null while no live instance is configured. */
  endpoint: string | null;
  live: boolean;
  /** Facilities mapped to a DHIS2 organisation unit; a pull only covers these. */
  mapped: number;
  facilities: number;
  orgUnits: string;
  dataElements: string;
  schedule: string;
  onFailure: string;
}

/** What the administrator's ingestion screen says about the connection. */
export async function ingestionOverview(): Promise<IngestionOverview> {
  const [facilities, mapped, states, diseases] = await Promise.all([
    prisma.facility.count(),
    prisma.facility.count({ where: { dhis2OrgUnit: { not: null } } }),
    prisma.facility.findMany({ distinct: ["stateName"], select: { stateName: true } }),
    prisma.disease.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const { baseUrl } = dhis2Config();
  return {
    endpoint: baseUrl ? `${baseUrl}/api/dataValueSets` : null,
    live: dhis2Configured(),
    mapped,
    facilities,
    orgUnits: `${mapped} of ${facilities} facilities mapped to an organisation unit, across ${states.length} state${states.length === 1 ? "" : "s"}`,
    dataElements: `${diseases.map((d) => `${d.name} cases`).join(", ")} (monthly aggregate)`,
    schedule: DHIS2_SCHEDULE,
    onFailure: DHIS2_ON_FAILURE,
  };
}
