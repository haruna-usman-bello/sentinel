import "server-only";

import { revalidatePath } from "next/cache";

import { liveTransport, type Dhis2Transport } from "@/lib/dhis2/client";
import { dhis2Configured } from "@/lib/dhis2/config";
import {
  DEFAULT_LEVELS,
  planImport,
  resolveFacilities,
  type ImportRow,
  type LevelMap,
  type PreviewResult,
} from "@/lib/dhis2/org-units";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "@/lib/actions/shared";

/**
 * Building the facility register from the DHIS2 organisation-unit tree.
 *
 * The register is the system's reach: a facility that is not on it is never
 * collected from, and the detector never judges it. So an import is shown in
 * full and confirmed before anything is written — never applied straight from
 * a fetch.
 *
 * These are plain server functions, not actions. Only the two thin wrappers
 * in lib/actions/facilities.ts are exposed to the browser, because everything
 * exported from a "use server" module becomes a callable endpoint — and
 * `previewFacilityImport` takes a transport, which has no business being
 * reachable from a client.
 */

/**
 * Reads the tree and works out what an import would change, writing nothing.
 * Takes its transport so the whole path can be exercised against a stub.
 */
export async function previewFacilityImport(
  levels: LevelMap = DEFAULT_LEVELS,
  transport?: Dhis2Transport,
): Promise<PreviewResult> {
  const reader = transport ?? (dhis2Configured() ? liveTransport() : null);
  if (!reader) {
    return {
      ok: false,
      error:
        "No DHIS2 instance is configured, so there is no register to read. Set DHIS2_BASE_URL, DHIS2_USERNAME and DHIS2_PASSWORD.",
    };
  }

  let units;
  try {
    units = await reader.fetchOrganisationUnits(levels.facility);
  } catch (error) {
    return { ok: false, error: `Could not read the organisation units: ${(error as Error).message}` };
  }

  const known = await prisma.facility.findMany({
    select: { code: true, name: true, lgaName: true, stateName: true, dhis2OrgUnit: true },
  });

  const { facilities, rejected } = resolveFacilities(
    units,
    levels,
    known.map((f) => f.code),
  );
  const rows = planImport(
    facilities,
    known.map((f) => ({
      code: f.code,
      name: f.name,
      lga: f.lgaName,
      state: f.stateName,
      orgUnit: f.dhis2OrgUnit,
    })),
  );

  return { ok: true, preview: { rows, rejected, levels, fetched: units.length } };
}

/**
 * Applies the rows the administrator picked. A conflict is never applied —
 * two facilities cannot share a code, and the register is what every flag,
 * map and report is printed from.
 */
/**
 * Applies the rows the administrator picked. A conflict is never applied —
 * two facilities cannot share a code, and the register is what every flag,
 * map and report is printed from.
 */
export async function applyImport(
  rows: ImportRow[],
  actor: { id: string | null; name: string },
): Promise<ActionResult> {
  const applicable = rows.filter((r) => r.outcome !== "conflict" && r.outcome !== "unchanged");
  if (!applicable.length) return { ok: true, message: "Nothing to import." };

  let created = 0;
  let updated = 0;

  for (const row of applicable) {
    const existing = await prisma.facility.findFirst({
      where: { OR: [{ dhis2OrgUnit: row.orgUnit }, { code: row.code }] },
      select: { id: true, dhis2OrgUnit: true },
    });

    if (existing) {
      // Never steal an organisation unit from another facility.
      if (existing.dhis2OrgUnit && existing.dhis2OrgUnit !== row.orgUnit) continue;
      await prisma.facility.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          lgaName: row.lga,
          stateName: row.state,
          dhis2OrgUnit: row.orgUnit,
        },
      });
      updated++;
    } else {
      await prisma.facility.create({
        data: {
          code: row.code,
          name: row.name,
          lgaName: row.lga,
          stateName: row.state,
          dhis2OrgUnit: row.orgUnit,
        },
      });
      created++;
    }
  }

  const detail = [
    created ? `${created} added` : null,
    updated ? `${updated} updated` : null,
  ]
    .filter(Boolean)
    .join(", ");

  await prisma.activityLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      kind: "config",
      action: "Facility register imported from DHIS2",
      detail: detail || "no change",
    },
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Register updated — ${detail || "no change"}.`,
    description: "Imported facilities are collected from at the next pull.",
  };
}
