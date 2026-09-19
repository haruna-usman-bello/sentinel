"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SeverityRule } from "@/components/dashboard/badges";
import { ZONES } from "@/lib/data";
import { isOpen, type StateRollup } from "@/lib/domain";
import type { Facility, Flag } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Schematic facility positions on a grid, not a geographic projection. The
 * deployed app renders real coordinates on a Leaflet base map.
 */
export function FacilityMap({
  facilities,
  flags,
}: {
  facilities: Facility[];
  flags: Flag[];
}) {
  const router = useRouter();

  return (
    <div className="bg-secondary border-border rounded-md border p-[18px]">
      <div
        className="bg-card border-border relative h-[330px] rounded-md border"
        style={{
          backgroundImage:
            "linear-gradient(var(--line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--line-soft) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      >
        {facilities.map((facility) => {
          const open = flags.filter((f) => f.facility === facility.code && isOpen(f));
          const tone = open.some((f) => f.type === "statistical")
            ? "critical"
            : open.some((f) => f.type === "non_reporting")
              ? "warning"
              : "ok";

          return (
            <button
              key={facility.code}
              type="button"
              title={facility.name}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
              style={{ left: `${facility.mapX}%`, top: `${facility.mapY}%` }}
              onClick={() => {
                const target =
                  flags.find((f) => f.facility === facility.code && isOpen(f)) ??
                  flags.find((f) => f.facility === facility.code);
                if (!target) {
                  toast("No flag on that facility this period.");
                  return;
                }
                router.push(`/flags/${target.id}`);
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "border-card size-[13px] rounded-full border-2",
                  tone === "critical" &&
                    "bg-critical shadow-[0_0_0_1px_var(--critical),0_0_0_6px_color-mix(in_srgb,var(--critical)_16%,transparent)]",
                  tone === "warning" && "border-warning border-dashed bg-transparent",
                  tone === "ok" && "bg-success shadow-[0_0_0_1px_var(--border)]",
                )}
              />
              <span className="text-muted-foreground bg-card/80 rounded-sm px-[3px] font-mono text-[0.6rem] whitespace-nowrap">
                {facility.code}
              </span>
              <span className="sr-only">{facility.name}</span>
            </button>
          );
        })}
      </div>
      <div className="text-muted-foreground mt-[10px] flex flex-wrap gap-4 text-[0.76rem]">
        <span>
          <SeverityRule level="hi" />
          Statistical anomaly open
        </span>
        <span>
          <SeverityRule level="md" />
          Reported nothing this period (dashed ring)
        </span>
        <span>
          <SeverityRule level="lo" />
          Reporting normally
        </span>
      </div>
    </div>
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
