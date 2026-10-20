import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { liveTransport } from "@/lib/dhis2/client";

vi.mock("server-only", () => ({}));

/** A well-formed DHIS2 id: eleven characters, a letter first. */
const uid = (i: number) => `F${String(i).padStart(10, "0")}`;

/**
 * The live transport against a stand-in for DHIS2 that answers every data
 * request with one value per facility asked about, and every outline request
 * with the units asked for, so each answer can be traced to its request. It
 * answers as DHIS2 2.43 does, stating the month once at the top rather than on
 * each value, and the facility too when only one was asked about.
 */
describe("the live DHIS2 transport", () => {
  const requests: URL[] = [];

  beforeEach(() => {
    requests.length = 0;
    vi.stubEnv("DHIS2_BASE_URL", "https://dhis2.example.org");
    vi.stubEnv("DHIS2_PAT", "d2pat_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        if (url.pathname.endsWith("/dataValueSets.json")) {
          const asked = url.searchParams.getAll("orgUnit");
          const dataValues = asked.map((orgUnit) => ({
            ...(asked.length > 1 ? { orgUnit } : {}),
            dataElement: "DE",
            categoryOptionCombo: "UNDER_5",
            value: "1",
          }));
          return Response.json({
            period: url.searchParams.get("period"),
            ...(asked.length === 1 ? { orgUnit: asked[0] } : {}),
            dataValues,
          });
        }
        const ids = /^id:in:\[(.*)\]$/.exec(url.searchParams.get("filter") ?? "")?.[1].split(",") ?? [];
        return Response.json({
          organisationUnits: ids.map((id) => ({ id, displayName: id, level: 3 })),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks for a large register a hundred facilities at a time, and keeps every answer", async () => {
    // A register the size of DHIS2's demo, whose server dropped a request for all of it at once.
    const orgUnits = Array.from({ length: 1166 }, (_, i) => uid(i));
    const values = await liveTransport().fetchDataValueSet({
      orgUnits,
      dataElements: ["DE"],
      period: "202609",
    });

    expect(requests).toHaveLength(12);
    expect(Math.max(...requests.map((r) => r.href.length))).toBeLessThan(3000);
    const asked = requests.flatMap((r) => r.searchParams.getAll("orgUnit"));
    expect(asked.sort()).toEqual([...orgUnits].sort());
    expect(values.map((v) => v.orgUnit).sort()).toEqual([...orgUnits].sort());
  });

  it("gives every value its month and facility, where DHIS2 states them once for all", async () => {
    // 101 facilities: the last request asks about one alone.
    const orgUnits = Array.from({ length: 101 }, (_, i) => uid(i));
    const values = await liveTransport().fetchDataValueSet({
      orgUnits,
      dataElements: ["DE"],
      period: "202609",
    });

    expect(requests.map((r) => r.searchParams.getAll("orgUnit").length)).toEqual([100, 1]);
    expect(values).toHaveLength(101);
    expect(values.every((v) => v.period === "202609")).toBe(true);
    expect(values.map((v) => v.orgUnit).sort()).toEqual([...orgUnits].sort());
  });

  it("asks nothing when there is nothing to ask about", async () => {
    const values = await liveTransport().fetchDataValueSet({
      orgUnits: [],
      dataElements: ["DE"],
      period: "202609",
    });
    expect(values).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it("reads outlines a few dozen LGAs at a time, and only by well-formed ids", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => uid(i));
    const units = await liveTransport().fetchOrganisationUnitsById([
      ...ids,
      "l-Zaria",
      "x],level:eq:1",
    ]);
    expect(requests).toHaveLength(3);
    expect(units.map((u) => u.id)).toEqual(ids);
  });
});
