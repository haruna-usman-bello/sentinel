"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { StatusPill } from "@/components/dashboard/badges";
import { Button } from "@/components/ui/button";
import { monthLabel, type StateRollup } from "@/lib/domain";
import type { Drawing } from "@/lib/geo";
import { ZONES } from "@/lib/geography";
import type { MapSite, SiteTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_ORDER: Record<SiteTone, number> = { rise: 0, silent: 1, ok: 2 };

/** A facility's mark, as on the map and in its key. */
function Dot({ tone, selected = false }: { tone: SiteTone; selected?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block shrink-0 rounded-full border-2",
        tone === "rise" &&
          "bg-critical border-card size-[14px] shadow-[0_0_0_5px_color-mix(in_srgb,var(--critical)_18%,transparent)]",
        tone === "silent" && "bg-card border-warning size-[14px] border-dashed",
        tone === "ok" && "bg-success border-card size-[11px]",
        selected && "outline-foreground outline-2 outline-offset-2",
      )}
    />
  );
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** About how wide a label's character is, in pixels, at the size labels are set. */
const CHAR_PX = 6.4;
const LABEL_PX = 18;

type Box = [left: number, top: number, right: number, bottom: number];

const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Which facilities get a name beside their mark, and where. The one selected
 * always does; on a wide enough LGA map, so does each that needs attention,
 * where its name fits without covering another name or mark. A name goes to
 * the right of its mark, else the left, above or below, whichever is clear
 * first. Everything else is named in the side panel when tapped.
 */
function placeLabels(
  placed: MapSite[],
  selected: string | null,
  size: { width: number; height: number },
  nameFlagged: boolean,
): Map<string, React.CSSProperties> {
  const at = (s: MapSite) => ({
    x: (s.at!.x / 100) * size.width,
    y: (s.at!.y / 100) * size.height,
  });
  const marks = placed.map((s) => {
    const { x, y } = at(s);
    return { code: s.code, box: [x - 8, y - 8, x + 8, y + 8] as Box };
  });
  const order = [
    ...placed.filter((s) => s.code === selected),
    ...(nameFlagged ? placed.filter((s) => s.code !== selected && s.tone !== "ok") : []),
  ];
  const taken: Box[] = [];
  const labels = new Map<string, React.CSSProperties>();

  for (const site of order) {
    const { x, y } = at(site);
    const w = site.name.length * CHAR_PX + 8;
    // Centred above or below, kept inside the map.
    const middle = Math.min(Math.max(x, w / 2), size.width - w / 2);
    const spots: { box: Box; style: React.CSSProperties }[] = [
      {
        box: [x + 10, y - LABEL_PX / 2, x + 12 + w, y + LABEL_PX / 2],
        style: { left: x + 12, top: y, transform: "translateY(-50%)" },
      },
      {
        box: [x - 12 - w, y - LABEL_PX / 2, x - 10, y + LABEL_PX / 2],
        style: { right: size.width - x + 12, top: y, transform: "translateY(-50%)" },
      },
      {
        box: [middle - w / 2, y - 12 - LABEL_PX, middle + w / 2, y - 12],
        style: { left: middle, top: y - 12, transform: "translate(-50%, -100%)" },
      },
      {
        box: [middle - w / 2, y + 12, middle + w / 2, y + 12 + LABEL_PX],
        style: { left: middle, top: y + 12, transform: "translateX(-50%)" },
      },
    ];
    const fitting = spots.filter(
      ({ box }) => box[0] >= 0 && box[2] <= size.width && box[1] >= -8 && box[3] <= size.height + 8,
    );
    const clashes = (box: Box) =>
      taken.filter((t) => overlaps(t, box)).length +
      marks.filter((m) => m.code !== site.code && overlaps(m.box, box)).length;
    const clear = fitting.find(({ box }) => clashes(box) === 0);
    // The selected one is named even in a crowd, wherever it covers least.
    const spot =
      clear ??
      (site.code === selected
        ? ([...fitting].sort((a, b) => clashes(a.box) - clashes(b.box))[0] ?? spots[2])
        : undefined);
    if (!spot) continue;
    taken.push(spot.box);
    labels.set(site.code, spot.style);
  }
  return labels;
}

function describe(site: MapSite): string {
  if (site.tone === "ok") return "no open flags";
  const n = site.flags.length;
  return `${site.tone === "rise" ? "unusual rise" : "no report"}, ${n} open flag${n === 1 ? "" : "s"}`;
}

/**
 * An LGA's or a state's facilities where they really are, inside the outlines
 * DHIS2 gives, each coloured by the most pressing thing open on it. No street
 * map underneath: it loads fast on a weak connection and needs no outside map
 * service. A facility with no usable location is listed under the map instead,
 * so none drops out of sight.
 */
export function AreaMap({
  place,
  drawing,
  sites,
  nameLgas,
  missingNote,
}: {
  /** "Zaria LGA", "Kaduna State". */
  place: string;
  drawing: Drawing | null;
  sites: MapSite[];
  /** Names each LGA on the map and each facility's LGA: a state's map, not an LGA's. */
  nameLgas: boolean;
  missingNote: string;
}) {
  // Most pressing first: the first is selected, and a rise is drawn over the rest.
  const ordered = [...sites].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const placed = ordered.filter((s) => s.at);
  const unplaced = ordered.filter((s) => !s.at);
  const attention = sites.filter((s) => s.tone !== "ok").length;

  const [selected, setSelected] = useState<string | null>(
    () => (placed.find((s) => s.tone !== "ok") ?? unplaced.find((s) => s.tone !== "ok"))?.code ?? null,
  );
  const site = sites.find((s) => s.code === selected) ?? null;

  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const measured = useWidth(frame);
  // Until the map has been measured, assume a desktop column.
  const width = measured || 640;
  const size = drawing ? { width, height: (width * drawing.height) / drawing.width } : null;
  // Below this width only the facility tapped is named; more would not be legible.
  const roomy = width >= 448;
  // Names are placed by measure, so they wait for the map to be measured.
  const labels =
    size && measured
      ? placeLabels(placed, selected, size, roomy && !nameLgas)
      : new Map<string, React.CSSProperties>();

  function pickFromList(code: string) {
    setSelected(code);
    // On a phone the panel sits above the list, out of view.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  if (!sites.length) {
    return (
      <p className="text-muted-foreground text-[0.88rem]">
        There are no facilities on the register for {place} yet.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground flex flex-wrap gap-x-[18px] gap-y-1 text-[0.88rem]">
        <span>
          <b className="text-foreground tnum font-semibold">{attention}</b>{" "}
          {attention === 1 ? "needs" : "need"} attention
        </span>
        <span>
          <b className="text-foreground tnum font-semibold">{sites.length - attention}</b> with no open
          flags
        </span>
        {unplaced.length ? (
          <span>
            <b className="text-foreground tnum font-semibold">{unplaced.length}</b> not on the map
          </span>
        ) : null}
      </p>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-card border-border overflow-hidden rounded-md border">
          {drawing ? (
            <div className="p-3">
              <div
                ref={frame}
                className="relative w-full"
                style={{ aspectRatio: `${drawing.width} / ${drawing.height}` }}
              >
                <svg
                  viewBox={`0 0 ${drawing.width} ${drawing.height}`}
                  className="absolute inset-0 size-full"
                  role="img"
                  aria-label={`Map of ${place} with its facilities`}
                >
                  {drawing.areas.map((area) => (
                    <path
                      key={area.name}
                      d={area.d}
                      fillRule="evenodd"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className="fill-secondary stroke-faint [stroke-width:1.5]"
                    />
                  ))}
                </svg>

                {nameLgas && roomy
                  ? drawing.areas.map((area) => (
                      <span
                        key={area.name}
                        aria-hidden
                        className="text-faint pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[0.6rem] tracking-[0.1em] whitespace-nowrap uppercase"
                        style={{ left: `${area.label.x}%`, top: `${area.label.y}%` }}
                      >
                        {area.name}
                      </span>
                    ))
                  : null}

                {placed.map((s) => {
                  const chosen = s.code === selected;
                  return (
                    <button
                      key={s.code}
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`${s.name}, ${describe(s)}`}
                      onClick={() => setSelected(s.code)}
                      className={cn(
                        "focus-visible:outline-ring absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2",
                        chosen ? "z-[4]" : s.tone === "rise" ? "z-[3]" : s.tone === "silent" ? "z-[2]" : "z-[1]",
                      )}
                      style={{ left: `${s.at!.x}%`, top: `${s.at!.y}%` }}
                    >
                      <Dot tone={s.tone} selected={chosen} />
                    </button>
                  );
                })}

                {placed
                  .filter((s) => labels.has(s.code))
                  .map((s) => (
                    <span
                      key={s.code}
                      aria-hidden
                      className="text-foreground pointer-events-none absolute z-[5] text-[0.72rem] leading-[18px] font-semibold whitespace-nowrap [text-shadow:0_0_3px_var(--secondary),0_0_3px_var(--secondary),0_0_2px_var(--secondary)]"
                      style={labels.get(s.code)}
                    >
                      {s.name}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground m-0 px-6 py-12 text-center text-[0.85rem]">
              DHIS2 gives no location for any facility here yet, so there is nothing to place on
              the map.
            </p>
          )}
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 px-[14px] pb-3 text-[0.78rem]">
            <span className="inline-flex items-center gap-[7px]">
              <Dot tone="rise" />
              Unusual rise
            </span>
            <span className="inline-flex items-center gap-[7px]">
              <Dot tone="silent" />
              No report
            </span>
            <span className="inline-flex items-center gap-[7px]">
              <Dot tone="ok" />
              No open flags
            </span>
          </div>
        </div>

        <div
          ref={panel}
          aria-live="polite"
          className="bg-card border-border flex scroll-mt-4 flex-col gap-3 rounded-md border px-[17px] py-4"
        >
          {site ? (
            <>
              <div>
                <h2 className="text-[1.05rem] font-semibold">{site.name}</h2>
                <p className="text-faint mt-[2px] font-mono text-[0.72rem]">
                  {[
                    site.code,
                    nameLgas ? `${site.lga} LGA` : null,
                    site.lastReport ? `last report ${monthLabel(site.lastReport)}` : "no report yet",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {site.flags.length ? (
                site.flags.map((flag) => (
                  <div
                    key={flag.id}
                    className={cn(
                      "border-border flex flex-col gap-[6px] rounded-md border border-l-[3px] px-3 py-[10px]",
                      flag.type === "statistical" ? "border-l-critical" : "border-l-warning",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[0.9rem] font-semibold">{flag.disease}</span>
                      <StatusPill status={flag.status} />
                    </div>
                    <span className="text-muted-foreground text-[0.82rem]">{flag.line}</span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-faint text-[0.78rem]">{flag.hint}</span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/flags/${flag.id}?from=map`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-[0.86rem]">No open flags.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-[0.86rem]">
              Nothing needs attention in {place}. Tap a facility to see it.
            </p>
          )}
        </div>
      </div>

      {unplaced.length ? (
        <div className="bg-card border-border flex flex-col gap-2 rounded-md border px-[17px] py-[14px]">
          <h3 className="text-[0.95rem] font-semibold">Not on the map ({unplaced.length})</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {unplaced.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  aria-pressed={s.code === selected}
                  onClick={() => pickFromList(s.code)}
                  className="hover:text-brand inline-flex cursor-pointer items-center gap-2 text-left text-[0.86rem]"
                >
                  <Dot tone={s.tone} selected={s.code === selected} />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">— {s.missing}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-[0.83rem]">{missingNote}</p>
        </div>
      ) : null}
    </>
  );
}

/**
 * A schematic cartogram, not a projection — states are grouped into the six
 * geopolitical zones NCDC reports by, so relative burden reads at a glance
 * without implying precise boundaries.
 */
export function ZoneCartogram({ rollup }: { rollup: StateRollup[] }) {
  const router = useRouter();
  const byState = new Map(rollup.map((r) => [r.state, r]));

  const chipClass = (row: StateRollup | undefined) =>
    cn(
      "border-border bg-secondary text-muted-foreground rounded-md border px-[9px] py-1 text-[0.78rem] transition-colors",
      row && "hover:border-brand cursor-pointer",
      row?.confirmed ? "border-critical/50 bg-critical-soft text-critical font-semibold" : "",
      row && !row.confirmed && row.open
        ? "border-warning/50 bg-warning-soft text-warning font-semibold"
        : "",
    );

  return (
    <>
      <div className="bg-secondary border-border rounded-md border p-[18px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-3">
          {Object.entries(ZONES).map(([zone, states]) => {
            const flagged = states.filter((s) => byState.get(s)?.open).length;
            return (
              <div
                key={zone}
                className="bg-card border-border rounded-md border px-[14px] py-[13px]"
              >
                <h4 className="text-faint mb-[10px] font-mono text-[0.62rem] font-medium tracking-[0.11em] uppercase">
                  {zone} — {flagged} of {states.length} flagged
                </h4>
                <div className="flex flex-wrap gap-[6px]">
                  {states.map((state) => {
                    const row = byState.get(state);
                    return (
                      <button
                        key={state}
                        type="button"
                        disabled={!row}
                        className={chipClass(row)}
                        onClick={() =>
                          router.push(`/flags?state=${encodeURIComponent(state)}`)
                        }
                      >
                        {state}
                        {row ? (
                          <span className="sr-only">
                            , {row.open} open flag{row.open === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-4 text-[0.76rem]">
        <span className="flex items-center gap-2">
          <span className="border-critical/50 bg-critical-soft text-critical rounded-md border px-2 py-[2px] text-[0.72rem] font-semibold">
            Kaduna
          </span>
          Confirmed outbreak
        </span>
        <span className="flex items-center gap-2">
          <span className="border-warning/50 bg-warning-soft text-warning rounded-md border px-2 py-[2px] text-[0.72rem] font-semibold">
            Sokoto
          </span>
          Open flag, not yet decided
        </span>
        <span className="flex items-center gap-2">
          <span className="border-border bg-secondary text-muted-foreground rounded-md border px-2 py-[2px] text-[0.72rem]">
            Lagos
          </span>
          Nothing flagged this month
        </span>
      </div>
    </>
  );
}
