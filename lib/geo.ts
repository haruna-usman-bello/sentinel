/**
 * The little geography the maps need: reading DHIS2's GeoJSON, simplifying an
 * outline so it is light to store and draw, and fitting places into a drawing.
 * No I/O, so it is tested on its own.
 *
 * Coordinates follow GeoJSON's order, [longitude, latitude].
 */

export type LngLat = [number, number];
/** One closed line; the first ring of a polygon is its outline, any others are holes. */
export type Ring = LngLat[];
/** An area as one or more polygons, each a list of rings. */
export type Area = Ring[][];

export interface Point {
  lat: number;
  lng: number;
}

/** What DHIS2 returns as an organisation unit's `geometry`. */
export interface Geometry {
  type: string;
  coordinates: unknown;
}

const isLngLat = (v: unknown): v is LngLat =>
  Array.isArray(v) &&
  v.length >= 2 &&
  typeof v[0] === "number" &&
  typeof v[1] === "number" &&
  Math.abs(v[0]) <= 180 &&
  Math.abs(v[1]) <= 90;

/** A facility's location, or null where DHIS2 gives none or gives an area instead. */
export function pointOf(geometry: Geometry | null | undefined): Point | null {
  if (geometry?.type !== "Point" || !isLngLat(geometry.coordinates)) return null;
  const [lng, lat] = geometry.coordinates;
  return { lat, lng };
}

/** Perpendicular distance from `p` to the line through `a` and `b`, in degrees. */
function offset(p: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.hypot(dx, dy);
}

/**
 * Douglas–Peucker: drops the points that sit within `tolerance` degrees of
 * the line the outline would take without them. 0.002° is about 200 m — far
 * finer than a screen shows an LGA, and it cuts a surveyed outline of
 * thousands of points to a few hundred.
 */
export function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 3) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let furthest = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = offset(ring[i], ring[first], ring[last]);
      if (d > furthest) {
        furthest = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const round = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * An LGA's outline from a Polygon or MultiPolygon, simplified and rounded to
 * about a metre; null for anything else, or for an outline that simplifies
 * away to nothing.
 */
export function areaOf(geometry: Geometry | null | undefined, tolerance = 0.002): Area | null {
  if (!geometry) return null;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? (geometry.coordinates as unknown[])
        : [];
  const area: Area = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon)) continue;
    const rings: Ring[] = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || !ring.every(isLngLat)) continue;
      const simple = simplify(ring as Ring, tolerance).map(([lng, lat]) => [round(lng), round(lat)] as LngLat);
      if (simple.length >= 4) rings.push(simple);
    }
    if (rings.length) area.push(rings);
  }
  return area.length ? area : null;
}

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The smallest box holding every area and point; null when there is nothing to hold. */
export function boundsOf(areas: Area[], points: Point[]): Box | null {
  let box: Box | null = null;
  const take = (lng: number, lat: number) => {
    box = box
      ? {
          west: Math.min(box.west, lng),
          south: Math.min(box.south, lat),
          east: Math.max(box.east, lng),
          north: Math.max(box.north, lat),
        }
      : { west: lng, south: lat, east: lng, north: lat };
  };
  for (const area of areas) for (const polygon of area) for (const ring of polygon) for (const [lng, lat] of ring) take(lng, lat);
  for (const p of points) take(p.lng, p.lat);
  return box;
}

export interface Projection {
  /** [x, y] in the drawing, north up. */
  project(lng: number, lat: number): [number, number];
  width: number;
  height: number;
}

/**
 * Fits `box` into a drawing `width` wide, keeping its shape: a degree of
 * longitude is shortened by the cosine of the latitude, as it is on the
 * ground. The height follows from the shape, within `minHeight` and
 * `maxHeight`, and the content is centred with `pad` all round.
 */
export function projection(
  box: Box,
  { width = 1000, pad = 40, minHeight = 420, maxHeight = 1000 } = {},
): Projection {
  const midLat = ((box.north + box.south) / 2) * (Math.PI / 180);
  // A single place, or a line of them, still gets a little area around it.
  const spanX = Math.max((box.east - box.west) * Math.cos(midLat), 0.01);
  const spanY = Math.max(box.north - box.south, 0.01);
  const inner = width - pad * 2;
  const height = Math.min(Math.max((inner * spanY) / spanX + pad * 2, minHeight), maxHeight);
  const scale = Math.min(inner / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const midLng = (box.east + box.west) / 2;
  const midLatDeg = (box.north + box.south) / 2;
  const west = midLng - spanX / Math.cos(midLat) / 2;
  const north = midLatDeg + spanY / 2;
  return {
    width,
    height,
    project(lng, lat) {
      return [
        offsetX + (lng - west) * Math.cos(midLat) * scale,
        offsetY + (north - lat) * scale,
      ];
    },
  };
}

/** An area as an SVG path, every ring closed. */
export function pathOf(area: Area, { project }: Pick<Projection, "project">): string {
  return area
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map(([lng, lat], i) => {
              const [x, y] = project(lng, lat);
              return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join("") + "Z",
      ),
    )
    .join("");
}

/**
 * Where to label an area: the centre of mass of its largest polygon's
 * outline. A surveyed boundary has most of its points where it is most
 * winding, so their plain mean would drift that way.
 */
export function middleOf(area: Area): Point {
  let best: { size: number; lng: number; lat: number } | null = null;
  for (const [ring] of area) {
    let twice = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      twice += cross;
      x += (x0 + x1) * cross;
      y += (y0 + y1) * cross;
    }
    if (twice !== 0 && (!best || Math.abs(twice) > best.size)) {
      best = { size: Math.abs(twice), lng: x / (3 * twice), lat: y / (3 * twice) };
    }
  }
  if (best) return { lat: best.lat, lng: best.lng };
  // A degenerate outline has no area to balance; any of its points will do.
  const [lng, lat] = area[0][0][0];
  return { lat, lng };
}

/** An area simplified further, for a drawing at a smaller scale. */
export function coarser(area: Area, tolerance: number): Area {
  return areaOf({ type: "MultiPolygon", coordinates: area }, tolerance) ?? area;
}

/** A position in a drawing, in percent of its width and height. */
export interface Placed {
  x: number;
  y: number;
}

export interface Drawing {
  /** The drawing's own units, for its viewBox; its shape is width by height. */
  width: number;
  height: number;
  areas: { name: string; d: string; label: Placed }[];
  /** Each point given, in order; null where it has no location or lies off the map. */
  points: (Placed | null)[];
}

/**
 * Lays areas and points out in one drawing. Where there are areas, a point
 * well beyond them is left off rather than drawn: a location DHIS2 has wrong
 * (latitude and longitude swapped, say) would otherwise shrink the whole map
 * to make room for it. Null when there is nothing to draw at all.
 */
export function drawMap(
  areas: { name: string; shape: Area }[],
  points: (Point | null)[],
  options: Parameters<typeof projection>[1] = {},
): Drawing | null {
  const around = boundsOf(
    areas.map((a) => a.shape),
    [],
  );
  const margin = around
    ? Math.max(around.east - around.west, around.north - around.south, 0.2) * 0.25
    : 0;
  const onMap = (p: Point | null): p is Point =>
    p !== null &&
    (!around ||
      (p.lng >= around.west - margin &&
        p.lng <= around.east + margin &&
        p.lat >= around.south - margin &&
        p.lat <= around.north + margin));

  const box = boundsOf(
    areas.map((a) => a.shape),
    points.filter(onMap),
  );
  if (!box) return null;
  const view = projection(box, options);
  const percent = (lng: number, lat: number): Placed => {
    const [x, y] = view.project(lng, lat);
    return {
      x: Math.round((x / view.width) * 1e4) / 100,
      y: Math.round((y / view.height) * 1e4) / 100,
    };
  };
  return {
    width: view.width,
    height: Math.round(view.height),
    areas: areas.map(({ name, shape }) => {
      const middle = middleOf(shape);
      return { name, d: pathOf(shape, view), label: percent(middle.lng, middle.lat) };
    }),
    points: points.map((p) => (onMap(p) ? percent(p.lng, p.lat) : null)),
  };
}
