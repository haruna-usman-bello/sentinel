import { describe, expect, it } from "vitest";

import {
  areaOf,
  boundsOf,
  drawMap,
  middleOf,
  pathOf,
  pointOf,
  projection,
  simplify,
  type Area,
  type Ring,
} from "@/lib/geo";

describe("pointOf", () => {
  it("reads a GeoJSON point as latitude and longitude", () => {
    expect(pointOf({ type: "Point", coordinates: [7.7199, 11.0855] })).toEqual({ lat: 11.0855, lng: 7.7199 });
  });
  it("gives nothing for an area, a missing geometry or nonsense", () => {
    expect(pointOf({ type: "Polygon", coordinates: [] })).toBeNull();
    expect(pointOf(null)).toBeNull();
    expect(pointOf({ type: "Point", coordinates: [700, 11] })).toBeNull();
  });
});

describe("simplify", () => {
  it("drops points that sit on the line between their neighbours, keeping the corners", () => {
    const ring: Ring = [[0, 0], [1, 0.0001], [2, 0], [2, 2], [0, 2], [0, 0]];
    expect(simplify(ring, 0.01)).toEqual([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
  });
  it("keeps a point that bends the outline by more than the tolerance", () => {
    const ring: Ring = [[0, 0], [1, 0.5], [2, 0], [2, 2], [0, 2], [0, 0]];
    expect(simplify(ring, 0.01)).toContainEqual([1, 0.5]);
  });
});

describe("areaOf", () => {
  const square = [[[7, 11], [8, 11], [8, 12], [7, 12], [7, 11]]];
  it("reads a polygon and a multipolygon", () => {
    expect(areaOf({ type: "Polygon", coordinates: square })).toEqual([square]);
    expect(areaOf({ type: "MultiPolygon", coordinates: [square, square] })).toHaveLength(2);
  });
  it("gives nothing for a point, or for an outline too small to draw", () => {
    expect(areaOf({ type: "Point", coordinates: [7, 11] })).toBeNull();
    expect(areaOf({ type: "Polygon", coordinates: [[[7, 11], [8, 11], [7, 11]]] })).toBeNull();
  });
});

describe("projection", () => {
  const box = { west: 7, south: 11, east: 8, north: 12 };
  it("puts north at the top and west on the left, inside the padding", () => {
    const p = projection(box, { width: 1000, pad: 40 });
    const [x1, y1] = p.project(7, 12);
    const [x2, y2] = p.project(8, 11);
    expect(x1).toBeLessThan(x2);
    expect(y1).toBeLessThan(y2);
    for (const v of [x1, x2]) expect(v).toBeGreaterThanOrEqual(40 - 1e-9);
    for (const v of [x1, x2]) expect(v).toBeLessThanOrEqual(960 + 1e-9);
    for (const v of [y1, y2]) expect(v).toBeGreaterThanOrEqual(40 - 1e-9);
    for (const v of [y1, y2]) expect(v).toBeLessThanOrEqual(p.height - 40 + 1e-9);
  });
  it("shortens a degree of longitude away from the equator, as on the ground", () => {
    const p = projection(box, { width: 1000, pad: 0, minHeight: 0, maxHeight: 10_000 });
    const [x1] = p.project(7, 11.5);
    const [x2] = p.project(8, 11.5);
    const [, y1] = p.project(7.5, 12);
    const [, y2] = p.project(7.5, 11);
    expect((x2 - x1) / (y2 - y1)).toBeCloseTo(Math.cos((11.5 * Math.PI) / 180), 3);
  });
  it("gives a single place room around it", () => {
    const p = projection({ west: 7.7, south: 11.08, east: 7.7, north: 11.08 });
    const [x, y] = p.project(7.7, 11.08);
    expect(x).toBeCloseTo(p.width / 2, 6);
    expect(y).toBeCloseTo(p.height / 2, 6);
  });
});

describe("boundsOf, pathOf and middleOf", () => {
  const area = [[[[7, 11], [8, 11], [8, 12], [7, 12], [7, 11]]]] as Ring[][];
  it("holds every area and point", () => {
    expect(boundsOf([area], [{ lat: 12.5, lng: 6.5 }])).toEqual({ west: 6.5, south: 11, east: 8, north: 12.5 });
    expect(boundsOf([], [])).toBeNull();
  });
  it("draws a closed path and finds a middle to label", () => {
    const p = projection({ west: 7, south: 11, east: 8, north: 12 });
    expect(pathOf(area, p)).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+){4}Z$/);
    expect(middleOf(area)).toEqual({ lat: 11.5, lng: 7.5 });
  });
  it("labels an area at its largest part, not where its outline is busiest", () => {
    // A big square, then a tiny island; the big square's outline is drawn
    // with many points along one side.
    const big: Ring = [[7, 11], [7.2, 11], [7.4, 11], [7.6, 11], [7.8, 11], [8, 11], [8, 12], [7, 12], [7, 11]];
    const island: Ring = [[9, 13], [9.1, 13], [9.1, 13.1], [9, 13.1], [9, 13]];
    const middle = middleOf([[island], [big]]);
    expect(middle.lng).toBeCloseTo(7.5, 9);
    expect(middle.lat).toBeCloseTo(11.5, 9);
  });
});

describe("drawMap", () => {
  const zaria: Area = [[[[7.6, 10.9], [7.9, 10.9], [7.9, 11.1], [7.6, 11.1], [7.6, 10.9]]]];
  const giwa: Area = [[[[7.3, 11.1], [7.6, 11.1], [7.6, 11.4], [7.3, 11.4], [7.3, 11.1]]]];

  it("places each point in percent of the drawing, in the order given", () => {
    const drawing = drawMap(
      [{ name: "Zaria", shape: zaria }, { name: "Giwa", shape: giwa }],
      [{ lat: 11.0, lng: 7.75 }, null],
    )!;
    expect(drawing.areas.map((a) => a.name)).toEqual(["Zaria", "Giwa"]);
    const [inside, unknown] = drawing.points;
    expect(unknown).toBeNull();
    expect(inside!.x).toBeGreaterThan(50);
    expect(inside!.y).toBeGreaterThan(50);
    // Zaria is south-east of Giwa: right of it and below it.
    const [zLabel, gLabel] = drawing.areas.map((a) => a.label);
    expect(zLabel.x).toBeGreaterThan(gLabel.x);
    expect(zLabel.y).toBeGreaterThan(gLabel.y);
  });

  it("leaves off a point far beyond the areas, without moving the rest", () => {
    const alone = drawMap([{ name: "Zaria", shape: zaria }], [{ lat: 11.0, lng: 7.75 }])!;
    // Latitude and longitude swapped: a point in Cameroon.
    const swapped = drawMap(
      [{ name: "Zaria", shape: zaria }],
      [{ lat: 11.0, lng: 7.75 }, { lat: 7.75, lng: 11.0 }],
    )!;
    expect(swapped.points[1]).toBeNull();
    expect(swapped.points[0]).toEqual(alone.points[0]);
    expect(swapped.areas).toEqual(alone.areas);
  });

  it("draws points alone where there is no outline, and nothing from nothing", () => {
    const drawing = drawMap([], [{ lat: 11.0, lng: 7.75 }, { lat: 11.1, lng: 7.7 }])!;
    expect(drawing.areas).toEqual([]);
    expect(drawing.points.every((p) => p !== null)).toBe(true);
    expect(drawMap([], [null])).toBeNull();
  });
});
