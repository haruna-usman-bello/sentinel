import { afterAll, describe, expect, it } from "vitest";

import { applyImport, previewFacilityImport } from "@/lib/facilities/import";
import { fixtureTransport } from "@/lib/dhis2/client";
import type { OrgUnit } from "@/lib/dhis2/org-units";
import { prisma } from "@/lib/prisma";

/**
 * Importing the facility register against the seeded database. The seed's
 * facilities carry no organisation unit, so DHIS2 offering them is the
 * "attach" case, and anything it offers that the register has never heard of
 * is the "add" case.
 */

const ancestors = (state: string, lga: string) => [
  { id: "root", displayName: "Nigeria", level: 1 },
  { id: `s-${state}`, displayName: state, level: 2 },
  { id: `l-${lga}`, displayName: lga, level: 3 },
];

const unit = (id: string, name: string, state: string, lga: string, code?: string): OrgUnit => ({
  id,
  displayName: name,
  code,
  level: 4,
  ancestors: ancestors(state, lga),
});

/** Names a facility the seed already knows, with its own code. */
const KNOWN = unit("ZGHorgunit1", "Zaria General Hospital", "Kaduna", "Zaria", "F01");
const BRAND_NEW = unit("NEWorgunit1", "Kwangila Health Post", "Kaduna", "Zaria", "K77");
const ORPHAN: OrgUnit = {
  id: "ORPHANunit1",
  displayName: "Unplaced Clinic",
  level: 4,
  ancestors: [{ id: "root", displayName: "Nigeria", level: 1 }],
};

async function reset() {
  await prisma.facility.deleteMany({ where: { code: "K77" } });
  await prisma.facility.updateMany({ data: { dhis2OrgUnit: null } });
  await prisma.activityLog.deleteMany({
    where: { action: "Facility register imported from DHIS2" },
  });
}

describe("importing the facility register", () => {
  afterAll(async () => {
    await reset();
    await prisma.$disconnect();
  });

  it("says plainly when there is no instance to read from", async () => {
    const result = await previewFacilityImport();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No DHIS2 instance is configured/);
  });

  it("plans an import without writing anything", async () => {
    await reset();
    const before = await prisma.facility.count();

    const result = await previewFacilityImport(
      { state: 2, lga: 3, facility: 4 },
      fixtureTransport([], [KNOWN, BRAND_NEW, ORPHAN]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { rows, rejected, fetched } = result.preview;
    expect(fetched).toBe(3);

    // The seed's facilities have no organisation unit, so this is an attach.
    expect(rows.find((r) => r.orgUnit === KNOWN.id)).toMatchObject({
      outcome: "remapped",
      code: "F01",
    });
    expect(rows.find((r) => r.orgUnit === BRAND_NEW.id)?.outcome).toBe("new");

    // A unit with nowhere to sit is reported, never guessed at.
    expect(rejected.map((r) => r.orgUnit)).toEqual([ORPHAN.id]);

    expect(await prisma.facility.count()).toBe(before);
  });

  it("attaches organisation units and adds what is missing", async () => {
    await reset();
    const before = await prisma.facility.count();

    const planned = await previewFacilityImport(
      { state: 2, lga: 3, facility: 4 },
      fixtureTransport([], [KNOWN, BRAND_NEW, ORPHAN]),
    );
    if (!planned.ok) throw new Error(planned.error);

    const result = await applyImport(planned.preview.rows, { id: null, name: "Test Administrator" });
    expect(result.ok).toBe(true);

    const zaria = await prisma.facility.findUniqueOrThrow({ where: { code: "F01" } });
    expect(zaria.dhis2OrgUnit).toBe(KNOWN.id);
    expect(zaria.name).toBe("Zaria General Hospital");

    const added = await prisma.facility.findUniqueOrThrow({ where: { code: "K77" } });
    expect(added).toMatchObject({
      name: "Kwangila Health Post",
      lgaName: "Zaria",
      stateName: "Kaduna",
      dhis2OrgUnit: BRAND_NEW.id,
    });

    expect(await prisma.facility.count()).toBe(before + 1);

    const logged = await prisma.activityLog.findFirst({
      where: { action: "Facility register imported from DHIS2" },
    });
    expect(logged?.detail).toMatch(/1 added/);
  });

  it("is safe to run twice — the second time changes nothing", async () => {
    const first = await previewFacilityImport(
      { state: 2, lga: 3, facility: 4 },
      fixtureTransport([], [KNOWN, BRAND_NEW]),
    );
    if (!first.ok) throw new Error(first.error);
    expect(first.preview.rows.every((r) => r.outcome === "unchanged")).toBe(true);

    const count = await prisma.facility.count();
    await applyImport(first.preview.rows, { id: null, name: "Test Administrator" });
    expect(await prisma.facility.count()).toBe(count);
  });

  it("will not let an import steal an organisation unit from another facility", async () => {
    // A different DHIS2 unit claiming a code that is already mapped.
    const impostor = unit("IMPOSTORun1", "Impostor Hospital", "Kaduna", "Zaria", "F01");
    const planned = await previewFacilityImport(
      { state: 2, lga: 3, facility: 4 },
      fixtureTransport([], [impostor]),
    );
    if (!planned.ok) throw new Error(planned.error);

    const row = planned.preview.rows[0];
    expect(row.outcome).toBe("conflict");
    expect(row.note).toMatch(/already uses the code/);

    // Even if the row were forced through, the write refuses it.
    await applyImport(planned.preview.rows, { id: null, name: "Test Administrator" });
    const zaria = await prisma.facility.findUniqueOrThrow({ where: { code: "F01" } });
    expect(zaria.dhis2OrgUnit).toBe(KNOWN.id);
    expect(zaria.name).toBe("Zaria General Hospital");
  });
});
