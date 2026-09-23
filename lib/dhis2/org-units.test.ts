import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEVELS,
  planImport,
  resolveFacilities,
  type KnownFacility,
  type OrgUnit,
} from "@/lib/dhis2/org-units";

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

describe("resolveFacilities", () => {
  it("reads the state and LGA from the levels above the facility", () => {
    const { facilities } = resolveFacilities([unit("DiszpKrYNg8", "Zaria General Hospital", "Kaduna", "Zaria")]);
    expect(facilities).toEqual([
      { orgUnit: "DiszpKrYNg8", name: "Zaria General Hospital", code: "DISZPK", state: "Kaduna", lga: "Zaria" },
    ]);
  });

  it("prefers the code DHIS2 already carries", () => {
    const { facilities } = resolveFacilities([unit("DiszpKrYNg8", "Zaria General Hospital", "Kaduna", "Zaria", "f01")]);
    expect(facilities[0].code).toBe("F01");
  });

  it("ignores units that are not at the facility level", () => {
    const state: OrgUnit = { id: "s1", displayName: "Kaduna", level: 2, ancestors: [] };
    const { facilities } = resolveFacilities([state, unit("a1b2c3d4e5f", "Kongo Clinic", "Kaduna", "Sabon Gari")]);
    expect(facilities).toHaveLength(1);
    expect(facilities[0].name).toBe("Kongo Clinic");
  });

  it("refuses to guess where the hierarchy does not reach", () => {
    const orphan: OrgUnit = {
      id: "orphan00001",
      displayName: "Floating Clinic",
      level: 4,
      ancestors: [{ id: "root", displayName: "Nigeria", level: 1 }],
    };
    const { facilities, rejected } = resolveFacilities([orphan]);
    expect(facilities).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/no state and LGA above it/);
  });

  it("never issues the same code twice, even against codes already in use", () => {
    const { facilities } = resolveFacilities(
      [
        unit("aaaaaaaaaaa", "One", "Kaduna", "Zaria", "DUP"),
        unit("bbbbbbbbbbb", "Two", "Kaduna", "Zaria", "DUP"),
        unit("ccccccccccc", "Three", "Kaduna", "Zaria", "DUP"),
      ],
      DEFAULT_LEVELS,
      ["BBBBBB"],
    );
    const codes = facilities.map((f) => f.code);
    expect(new Set(codes).size).toBe(3);
    expect(codes).not.toContain("BBBBBB");
  });

  it("honours a hierarchy of a different depth", () => {
    const shallow: OrgUnit = {
      id: "shallow0001",
      displayName: "District Clinic",
      level: 3,
      ancestors: [
        { id: "root", displayName: "Nigeria", level: 1 },
        { id: "s", displayName: "Kano", level: 2 },
      ],
    };
    const { facilities } = resolveFacilities([shallow], { state: 1, lga: 2, facility: 3 });
    expect(facilities[0]).toMatchObject({ state: "Nigeria", lga: "Kano", name: "District Clinic" });
  });
});

describe("planImport", () => {
  const resolved = resolveFacilities([
    unit("DiszpKrYNg8", "Zaria General Hospital", "Kaduna", "Zaria", "F01"),
    unit("aaaaaaaaaaa", "Brand New PHC", "Kaduna", "Giwa", "F99"),
  ]).facilities;

  const known = (over: Partial<KnownFacility> = {}): KnownFacility => ({
    code: "F01",
    name: "Zaria General Hospital",
    lga: "Zaria",
    state: "Kaduna",
    orgUnit: "DiszpKrYNg8",
    ...over,
  });

  it("marks a facility the register has never seen as new", () => {
    const rows = planImport(resolved, [known()]);
    expect(rows.find((r) => r.name === "Brand New PHC")?.outcome).toBe("new");
  });

  it("marks an already-mapped, unchanged facility as unchanged", () => {
    const rows = planImport(resolved, [known()]);
    expect(rows.find((r) => r.orgUnit === "DiszpKrYNg8")?.outcome).toBe("unchanged");
  });

  it("notices when DHIS2 has renamed or moved a mapped facility", () => {
    const rows = planImport(resolved, [known({ name: "Zaria GH (old name)" })]);
    const row = rows.find((r) => r.orgUnit === "DiszpKrYNg8")!;
    expect(row.outcome).toBe("renamed");
    expect(row.note).toMatch(/now calls it/);
  });

  it("offers to attach an organisation unit to a facility that has none", () => {
    const rows = planImport(resolved, [known({ orgUnit: null })]);
    const row = rows.find((r) => r.code === "F01")!;
    expect(row.outcome).toBe("remapped");
    expect(row.note).toMatch(/no organisation unit yet/);
  });

  it("refuses to take a code that another mapped facility already holds", () => {
    const rows = planImport(resolved, [known({ orgUnit: "somethingels" })]);
    const row = rows.find((r) => r.code === "F01")!;
    expect(row.outcome).toBe("conflict");
    expect(row.note).toMatch(/already uses the code/);
  });

  it("keeps the register's own code rather than renaming a known facility", () => {
    const rows = planImport(resolved, [known({ code: "ZGH" })]);
    expect(rows.find((r) => r.orgUnit === "DiszpKrYNg8")?.code).toBe("ZGH");
  });
});
