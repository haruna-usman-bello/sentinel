"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";
import {
  diseaseMappingSchema,
  facilityMappingSchema,
  fieldErrors,
} from "@/lib/validation";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * Which DHIS2 organisation unit each facility reports as, and which data
 * element each disease's counts arrive under. Only the administrator sets
 * these — they decide what the system collects, not what any of it means.
 *
 * Clearing a mapping takes the facility out of the pull. Its history stays,
 * and the detector stops judging it, because a facility nothing is collected
 * from has not gone silent.
 */

async function requireAdministrator() {
  if (!(await currentSession())) return null;
  const { user, role } = await viewer();
  return role.key === "sysadmin" ? user : undefined;
}

export async function setFacilityMappingAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdministrator();
  if (user === null) return SESSION_EXPIRED;
  if (user === undefined) {
    return { ok: false, error: "Only the system administrator sets the DHIS2 mapping." };
  }

  const parsed = facilityMappingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { facilityId, orgUnit } = parsed.data;

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) return { ok: false, error: "No such facility." };
  if (orgUnit === (facility.dhis2OrgUnit ?? "")) {
    return { ok: true, message: "No change to save." };
  }

  if (orgUnit) {
    const taken = await prisma.facility.findFirst({
      where: { dhis2OrgUnit: orgUnit, id: { not: facilityId } },
      select: { name: true },
    });
    if (taken) {
      return {
        ok: false,
        error: "Check the form.",
        fieldErrors: { orgUnit: `${taken.name} already reports as that organisation unit.` },
      };
    }
  }

  await prisma.$transaction([
    prisma.facility.update({
      where: { id: facilityId },
      data: { dhis2OrgUnit: orgUnit || null },
    }),
    prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        stateName: facility.stateName,
        kind: "config",
        action: orgUnit ? "Facility mapped to DHIS2" : "Facility unmapped from DHIS2",
        detail: orgUnit
          ? `${facility.name} (${facility.code}) → ${orgUnit}`
          : `${facility.name} (${facility.code}) is no longer collected from`,
      },
    }),
  ]);

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: orgUnit
      ? `${facility.name} is now collected from ${orgUnit}.`
      : `${facility.name} has been taken out of the pull.`,
    description: orgUnit ? "It is included from the next pull onwards." : undefined,
  };
}

export async function setDiseaseMappingAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdministrator();
  if (user === null) return SESSION_EXPIRED;
  if (user === undefined) {
    return { ok: false, error: "Only the system administrator sets the DHIS2 mapping." };
  }

  const parsed = diseaseMappingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { diseaseId, dataElement } = parsed.data;

  const disease = await prisma.disease.findUnique({ where: { id: diseaseId } });
  if (!disease) return { ok: false, error: "No such disease." };
  if (dataElement === (disease.dhis2DataElement ?? "")) {
    return { ok: true, message: "No change to save." };
  }

  if (dataElement) {
    const taken = await prisma.disease.findFirst({
      where: { dhis2DataElement: dataElement, id: { not: diseaseId } },
      select: { name: true },
    });
    if (taken) {
      return {
        ok: false,
        error: "Check the form.",
        fieldErrors: { dataElement: `${taken.name} already uses that data element.` },
      };
    }
  }

  await prisma.$transaction([
    prisma.disease.update({
      where: { id: diseaseId },
      data: { dhis2DataElement: dataElement || null },
    }),
    prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        stateName: null,
        kind: "config",
        action: dataElement ? "Disease mapped to DHIS2" : "Disease unmapped from DHIS2",
        detail: dataElement
          ? `${disease.name} → ${dataElement}`
          : `${disease.name} is no longer collected`,
      },
    }),
  ]);

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: dataElement
      ? `${disease.name} counts are read from ${dataElement}.`
      : `${disease.name} has been taken out of the pull.`,
  };
}
