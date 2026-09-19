"use client";

import { useMemo, useState } from "react";

import { monthLabel, monthTick } from "@/lib/domain";

const W = 720;
const H = 250;
const PAD = { left: 44, right: 34, top: 18, bottom: 34 };

export interface TrendPoint {
  period: string;
  count: number | null;
}

/**
 * Monthly case counts for one facility/disease against the six-month moving
 * average the detector scores them by. One measured series and one reference
 * line share a single axis — case counts, per month.
 */
export function CaseTrendChart({
  data,
  average,
  flaggedPeriods,
  disease,
  facilityName,
}: {
  data: TrendPoint[];
  average: (number | null)[];
  flaggedPeriods: Set<string>;
  disease: string;
  facilityName: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const counts = data.map((d) => d.count);

  const { step, x, y } = useMemo(() => {
    const observed = [...counts, ...average].filter((v): v is number => v !== null);
    const peak = Math.max(...observed, 1) * 1.15;
    const step = Math.max(5, Math.ceil(peak / 4 / 5) * 5);
    const top = step * 4;
    return {
      step,
      x: (i: number) =>
        PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, data.length - 1),
      y: (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom),
    };
  }, [counts, average, data.length]);

  const baseline = y(0);
  const lastIndex = data.length - 1;

  const linePoints = (values: (number | null)[]) =>
    values
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  const areaPoints = counts
    .map((v, i) => (v === null ? null : [x(i), y(v)] as const))
    .filter((p): p is readonly [number, number] => p !== null);

  const area = areaPoints.length
    ? `M${areaPoints[0][0].toFixed(1)},${baseline.toFixed(1)} ` +
      areaPoints.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ") +
      ` L${areaPoints[areaPoints.length - 1][0].toFixed(1)},${baseline.toFixed(1)} Z`
    : "";

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const plotted = (ratio * W - PAD.left) / (W - PAD.left - PAD.right);
    const index = Math.round(plotted * lastIndex);
    setHover(index >= 0 && index <= lastIndex ? index : null);
  }

  const active = hover === null ? null : data[hover];

  return (
    <div className="bg-card border-border rounded-md border p-4">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-none"
          role="img"
          aria-label={`Monthly ${disease} case counts at ${facilityName}, with the six-month moving average`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const value = i * step;
            const gy = y(value);
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={gy}
                  x2={W - PAD.right}
                  y2={gy}
                  stroke="var(--line-soft)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={gy + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--faint)"
                  fontFamily="var(--font-mono)"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {area ? <path d={area} fill="var(--chart-1)" opacity={0.08} /> : null}

          <polyline
            points={linePoints(average)}
            fill="none"
            stroke="var(--faint)"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <polyline
            points={linePoints(counts)}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {counts.map((value, i) =>
            value === null ? (
              // A gap is drawn at the baseline as an open ring: nothing arrived.
              <circle
                key={data[i].period}
                cx={x(i)}
                cy={baseline}
                r={5}
                fill="none"
                stroke="var(--warning)"
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            ) : (
              <circle
                key={data[i].period}
                cx={x(i)}
                cy={y(value)}
                r={flaggedPeriods.has(data[i].period) ? 5 : 4}
                fill={
                  flaggedPeriods.has(data[i].period)
                    ? "var(--critical)"
                    : "var(--chart-1)"
                }
                stroke="var(--card)"
                strokeWidth={2}
              />
            ),
          )}

          {data.map((point, i) =>
            (i % 3 === 0 && i < lastIndex - 1) || i === lastIndex ? (
              <text
                key={point.period}
                x={x(i)}
                y={H - 12}
                textAnchor={i === lastIndex ? "end" : "middle"}
                fontSize={9.5}
                fill={i === lastIndex ? "var(--foreground)" : "var(--faint)"}
                fontFamily="var(--font-mono)"
              >
                {monthTick(point.period)}
              </text>
            ) : null,
          )}

          <text
            x={PAD.left}
            y={10}
            fontSize={9.5}
            fill="var(--faint)"
            fontFamily="var(--font-mono)"
          >
            CASES / MONTH
          </text>

          {hover !== null ? (
            <line
              x1={x(hover)}
              y1={PAD.top}
              x2={x(hover)}
              y2={baseline}
              stroke="var(--faint)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
        </svg>

        {active ? (
          <div
            className="bg-popover text-popover-foreground border-border pointer-events-none absolute top-2 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-md border p-2 text-[0.78rem] shadow-md"
            style={{
              left: `${((x(hover!) / W) * 100).toFixed(2)}%`,
            }}
          >
            <div className="font-mono text-[0.68rem] tracking-[0.08em] uppercase opacity-70">
              {monthLabel(active.period)}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: "var(--chart-1)" }}
              />
              {active.count === null ? (
                <span className="text-warning">No report received</span>
              ) : (
                <span className="tnum">{active.count} cases</span>
              )}
            </div>
            {average[hover!] !== null && average[hover!] !== undefined ? (
              <div className="mt-[3px] flex items-center gap-2 opacity-80">
                <span
                  aria-hidden
                  className="inline-block h-0 w-2 border-t-2 border-dashed"
                  style={{ borderColor: "var(--faint)" }}
                />
                <span className="tnum">{average[hover!]!.toFixed(1)} usual</span>
              </div>
            ) : null}
            {flaggedPeriods.has(active.period) ? (
              <div className="text-critical mt-[3px]">Flagged this month</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground mt-[10px] flex flex-wrap gap-4 text-[0.76rem]">
        <span className="flex items-center gap-[6px]">
          <span
            aria-hidden
            className="inline-block h-0 w-[14px] border-t-2"
            style={{ borderColor: "var(--chart-1)" }}
          />
          Reported cases
        </span>
        <span className="flex items-center gap-[6px]">
          <span
            aria-hidden
            className="inline-block h-0 w-[14px] border-t-2 border-dashed"
            style={{ borderColor: "var(--faint)" }}
          />
          6-month moving average
        </span>
        <span className="flex items-center gap-[6px]">
          <span
            aria-hidden
            className="bg-critical inline-block size-2 rounded-full"
          />
          Month flagged
        </span>
        <span className="flex items-center gap-[6px]">
          <span
            aria-hidden
            className="border-warning inline-block size-2 rounded-full border-2 border-dashed"
          />
          No report received
        </span>
      </div>

      <details className="mt-3">
        <summary className="text-muted-foreground cursor-pointer text-[0.78rem]">
          Show the underlying figures
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[0.78rem]">
            <thead>
              <tr className="text-faint text-left font-mono text-[0.62rem] tracking-[0.1em] uppercase">
                <th className="py-1 pr-4 font-medium">Month</th>
                <th className="py-1 pr-4 font-medium">Cases</th>
                <th className="py-1 font-medium">6-month average</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point, i) => (
                <tr key={point.period} className="border-line-soft border-t">
                  <td className="py-1 pr-4 font-mono">{monthLabel(point.period)}</td>
                  <td className="tnum py-1 pr-4 font-mono">
                    {point.count === null ? "no report" : point.count}
                  </td>
                  <td className="tnum text-muted-foreground py-1 font-mono">
                    {average[i] === null || average[i] === undefined
                      ? "—"
                      : average[i]!.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
