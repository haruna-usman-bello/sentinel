import "server-only";

import { prisma } from "@/lib/prisma";
import type { FacilityPin, Scope } from "@/lib/types";

import { facilityScope } from "./shared";

/** Facilities in scope that have a position on the schematic map. */
export async function listFacilityPins(scope: Scope): Promise<FacilityPin[]> {
  const where = facilityScope(scope);
  if (!where) return [];
  const rows = await prisma.facility.findMany({
    where: { ...where, mapX: { not: null }, mapY: { not: null } },
    select: { code: true, name: true, lgaName: true, stateName: true, mapX: true, mapY: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    lga: r.lgaName,
    state: r.stateName,
    mapX: r.mapX!,
    mapY: r.mapY!,
  }));
}

/** The LGAs of a state that have at least one facility, alphabetical. */
export async function listLgas(state: string): Promise<string[]> {
  const rows = await prisma.facility.findMany({
    where: { stateName: state },
    distinct: ["lgaName"],
    select: { lgaName: true },
    orderBy: { lgaName: "asc" },
  });
  return rows.map((r) => r.lgaName);
}
