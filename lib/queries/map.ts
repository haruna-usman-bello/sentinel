import "server-only";

import type { Area, Point } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/types";

import { facilityScope } from "./shared";

export interface MapFacility {
  code: string;
  name: string;
  lga: string;
  /** Where DHIS2 places it; null until it does. */
  location: Point | null;
  /** The latest month it reported a figure for, up to the period asked about. */
  lastReport: string | null;
}

/** Every facility in scope, placed or not, so none drops off the map unseen. */
export async function listMapFacilities(scope: Scope, period: string): Promise<MapFacility[]> {
  const where = facilityScope(scope);
  if (!where) return [];
  const [rows, reports] = await Promise.all([
    prisma.facility.findMany({
      where,
      select: { id: true, code: true, name: true, lgaName: true, latitude: true, longitude: true },
      orderBy: { name: "asc" },
    }),
    prisma.caseReport.groupBy({
      by: ["facilityId"],
      where: { facility: where, count: { not: null }, period: { lte: period } },
      _max: { period: true },
    }),
  ]);
  const last = new Map(reports.map((r) => [r.facilityId, r._max.period]));
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    lga: r.lgaName,
    location:
      r.latitude !== null && r.longitude !== null ? { lat: r.latitude, lng: r.longitude } : null,
    lastReport: last.get(r.id) ?? null,
  }));
}

export interface Outline {
  lga: string;
  shape: Area;
}

/** The outlines of the LGAs in scope, as last read from DHIS2. */
export async function listOutlines(scope: Scope): Promise<Outline[]> {
  if (scope.none || !scope.state) return [];
  const rows = await prisma.lgaBoundary.findMany({
    where: { stateName: scope.state, ...(scope.lga ? { lgaName: scope.lga } : {}) },
    select: { lgaName: true, shape: true },
    orderBy: { lgaName: "asc" },
  });
  return rows
    .filter((r) => Array.isArray(r.shape) && r.shape.length)
    .map((r) => ({ lga: r.lgaName, shape: r.shape as unknown as Area }));
}
