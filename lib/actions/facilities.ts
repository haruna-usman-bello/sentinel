"use server";

import {
  DEFAULT_LEVELS,
  type ImportRow,
  type LevelMap,
  type PreviewResult,
} from "@/lib/dhis2/org-units";
import { applyImport, previewFacilityImport } from "@/lib/facilities/import";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * The only two facility-register operations the browser can reach. Everything
 * they rest on lives in lib/facilities/import.ts, because every export of a
 * "use server" module becomes a callable endpoint whether it was meant to be
 * one or not.
 */

async function requireAdministrator() {
  if (!(await currentSession())) return null;
  const { user, role } = await viewer();
  return role.key === "sysadmin" ? user : undefined;
}

export async function previewFacilityImportAction(
  levels: LevelMap = DEFAULT_LEVELS,
): Promise<PreviewResult> {
  const user = await requireAdministrator();
  if (user === null) {
    return { ok: false, error: "Your session has expired. Sign in again to continue." };
  }
  if (user === undefined) {
    return { ok: false, error: "Only the system administrator imports the facility register." };
  }
  return previewFacilityImport(levels);
}

export async function importFacilitiesAction(rows: ImportRow[]): Promise<ActionResult> {
  const user = await requireAdministrator();
  if (user === null) return SESSION_EXPIRED;
  if (user === undefined) {
    return { ok: false, error: "Only the system administrator imports the facility register." };
  }
  return applyImport(rows, { id: user.id, name: user.name });
}
