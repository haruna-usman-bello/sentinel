import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { monthReporting } from "@/lib/queries/system";

/**
 * A month's reporting against the seeded database. The reference dataset
 * leaves three reports out of Kaduna's August — Hunkuyi PHC's Cholera, and
 * Kongo Clinic's and Wusasa Mission Hospital's Measles — and the detector
 * flagged each of them, so this is the case where every screen has to agree.
 */
describe("monthReporting", () => {
  it("counts Kaduna's August as 17 of the 20 reports it was owed", async () => {
    const august = await monthReporting({ state: "Kaduna" }, "2026-08");
    expect(august.expected).toBe(20);
    expect(august.received).toBe(17);
    expect(august.facilitiesMissing).toBe(3);
    expect(august.missing.map((m) => `${m.facilityName}/${m.disease}`)).toEqual([
      "Hunkuyi PHC/Cholera",
      "Kongo Clinic/Measles",
      "Wusasa Mission Hospital/Measles",
    ]);
    expect(august.missing.every((m) => m.flagId)).toBe(true);
  });

  it("names the same missing reports as the month's no-report flags, nationally", async () => {
    const august = await monthReporting({}, "2026-08");
    const flags = await prisma.flag.findMany({
      where: { period: "2026-08", type: "non_reporting" },
      select: { id: true },
    });
    expect(august.missing.map((m) => m.flagId).sort()).toEqual(flags.map((f) => f.id).sort());
  });

  it("keeps to the scope it is given", async () => {
    const zaria = await monthReporting({ state: "Kaduna", lga: "Zaria" }, "2026-08");
    expect(zaria.missing.map((m) => m.facilityName)).toEqual(["Wusasa Mission Hospital"]);
    expect(await monthReporting({ none: true }, "2026-08")).toMatchObject({ expected: 0, missing: [] });
  });

  it("owes nothing for a month nothing was collected for", async () => {
    const later = await monthReporting({ state: "Kaduna" }, "2031-01");
    expect(later).toMatchObject({ expected: 0, received: 0, missing: [] });
  });
});
