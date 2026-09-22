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

export interface MagnitudeBand {
  from: number;
  to: number;
  outbreaks: number;
  caught: number;
}

export interface SweepRow extends DetectorSweepRow {
  scored: number;
  f2: number;
  bands: MagnitudeBand[];
}

export interface DetectorEvaluation {
  records: number;
  scored: number;
  seeded: number;
  baselineMonths: number;
  corpusSeed: number;
  runAt: string;
  sweep: SweepRow[];
  /** The level the evaluation argues for. */
  recommended: SweepRow;
  /** What each disease is actually set to, and whether that matches. */
  inUse: { disease: string; k: number; matchesRecommendation: boolean }[];
}

/**
 * Every alert level the detector has been measured at, with the one the
 * evaluation recommends and what the system is actually set to. The two are
 * shown together because the interesting case is when they differ.
 */
export async function detectorEvaluation(): Promise<DetectorEvaluation | null> {
  const [rows, diseases] = await Promise.all([
    prisma.detectorSweep.findMany({
      orderBy: { alertLevelK: "asc" },
      include: { bands: { orderBy: { fromMagnitude: "asc" } } },
    }),
    prisma.disease.findMany({ select: { name: true, alertLevelK: true }, orderBy: { name: "asc" } }),
  ]);
  if (!rows.length) return null;

  const sweep: SweepRow[] = rows.map((r) => {
    const precision = r.truePositives / (r.truePositives + r.falsePositives || 1);
    const recall = r.truePositives / (r.truePositives + r.falseNegatives || 1);
    const f2 = 4 * precision + recall ? (5 * precision * recall) / (4 * precision + recall) : 0;
    return {
      k: r.alertLevelK,
      tp: r.truePositives,
      fp: r.falsePositives,
      fn: r.falseNegatives,
      tn: r.trueNegatives,
      selected: r.recommended,
      scored: r.scored,
      f2,
      bands: r.bands.map((b) => ({
        from: b.fromMagnitude,
        to: b.toMagnitude,
        outbreaks: b.outbreaks,
        caught: b.caught,
      })),
    };
  });

  const head = rows.find((r) => r.recommended) ?? rows[0];
  const recommended = sweep.find((r) => r.selected) ?? sweep[0];

  return {
    records: head.records,
    scored: head.scored,
    seeded: head.seeded,
    baselineMonths: head.baselineMonths,
    corpusSeed: head.corpusSeed,
    runAt: formatStamp(head.runAt),
    sweep,
    recommended,
    inUse: diseases.map((d) => ({
      disease: d.name,
      k: d.alertLevelK,
      matchesRecommendation: Math.abs(d.alertLevelK - recommended.k) < 0.001,
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

export interface FacilityMapping {
  id: string;
  code: string;
  name: string;
  lga: string;
  state: string;
  orgUnit: string;
  /** Reporting months held for this facility — 0 means nothing collected yet. */
  months: number;
}

export interface DiseaseMapping {
  id: string;
  name: string;
  dataElement: string;
}

/**
 * What the administrator maps to DHIS2. A pull covers exactly the facilities
 * that carry an organisation unit, so this screen decides the system's reach.
 */
export async function listMappings(): Promise<{
  facilities: FacilityMapping[];
  diseases: DiseaseMapping[];
}> {
  const [facilities, diseases, counts] = await Promise.all([
    prisma.facility.findMany({
      select: { id: true, code: true, name: true, lgaName: true, stateName: true, dhis2OrgUnit: true },
      orderBy: [{ stateName: "asc" }, { lgaName: "asc" }, { code: "asc" }],
    }),
    prisma.disease.findMany({
      select: { id: true, name: true, dhis2DataElement: true },
      orderBy: { name: "asc" },
    }),
    // Distinct months, not rows: a facility reporting two diseases over twenty
    // months has twenty months of record, not forty.
    prisma.caseReport.findMany({
      distinct: ["facilityId", "period"],
      select: { facilityId: true },
    }),
  ]);
  const held = new Map<string, number>();
  for (const row of counts) held.set(row.facilityId, (held.get(row.facilityId) ?? 0) + 1);
  return {
    facilities: facilities.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      lga: f.lgaName,
      state: f.stateName,
      orgUnit: f.dhis2OrgUnit ?? "",
      months: held.get(f.id) ?? 0,
    })),
    diseases: diseases.map((d) => ({
      id: d.id,
      name: d.name,
      dataElement: d.dhis2DataElement ?? "",
    })),
  };
}
