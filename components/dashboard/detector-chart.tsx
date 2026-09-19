"use client";

import { useState } from "react";

import { detectorMetrics, type DetectorMetrics } from "@/lib/domain";
import type { DetectorSweepRow } from "@/lib/types";

const W = 560;
const H = 250;
const PAD = { left: 46, right: 16, top: 20, bottom: 52 };

const METRICS: { key: keyof DetectorMetrics; label: string }[] = [
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1 score" },
  { key: "fpr", label: "False alarm rate" },
];

/**
 * The two candidate alert levels against each accuracy measure. All four
 * measures are 0–1 proportions, so they share one axis.
 */
export function DetectorChart({
  selected,
  alternate,
}: {
  selected: DetectorSweepRow;
  alternate: DetectorSweepRow;
}) {
  const [hover, setHover] = useState<{ metric: string; series: string; value: number } | null>(
    null,
  );

  const selectedMetrics = detectorMetrics(selected);
  const alternateMetrics = detectorMetrics(alternate);

  const groupWidth = (W - PAD.left - PAD.right) / METRICS.length;
  const barWidth = Math.min(30, groupWidth / 3.2);
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);
  const baseline = y(0);

  const series = [
    {
      name: `${selected.k.toFixed(1)}× (in use)`,
      color: "var(--chart-1)",
      metrics: selectedMetrics,
    },
    {
      name: `${alternate.k.toFixed(1)}×`,
      color: "var(--chart-2)",
      metrics: alternateMetrics,
    },
  ];

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Detector accuracy at ${selected.k.toFixed(1)}× against ${alternate.k.toFixed(1)}×, across precision, recall, F1 and false alarm rate`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y(v)}
                x2={W - PAD.right}
                y2={y(v)}
                stroke="var(--line-soft)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--faint)"
                fontFamily="var(--font-mono)"
              >
                {v.toFixed(2)}
              </text>
            </g>
          ))}

          {METRICS.map((metric, i) => {
            const centre = PAD.left + i * groupWidth + groupWidth / 2;
            return (
              <g key={metric.key}>
                {series.map((s, si) => {
                  const value = s.metrics[metric.key];
                  // 2px surface gap keeps adjacent bars from reading as one mark.
                  const bx = si === 0 ? centre - barWidth - 2 : centre + 2;
                  const height = Math.max(2, baseline - y(value));
                  return (
                    <g key={s.name}>
                      <rect
                        x={bx}
                        y={y(value)}
                        width={barWidth}
                        height={height}
                        fill={s.color}
                        rx={4}
                        onPointerEnter={() =>
                          setHover({ metric: metric.label, series: s.name, value })
                        }
                        onPointerLeave={() => setHover(null)}
                      />
                      <text
                        x={bx + barWidth / 2}
                        y={y(value) - 6}
                        textAnchor="middle"
                        fontSize={10.5}
                        fill="var(--muted-foreground)"
                        fontFamily="var(--font-mono)"
                      >
                        {value.toFixed(2)}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={centre}
                  y={H - 28}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--foreground)"
                >
                  {metric.label}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            y1={baseline}
            x2={W - PAD.right}
            y2={baseline}
            stroke="var(--border)"
            strokeWidth={1}
          />
        </svg>

        {hover ? (
          <div
            role="status"
            className="bg-popover text-popover-foreground border-border pointer-events-none absolute top-1 right-1 rounded-md border px-2 py-1 text-[0.76rem] shadow-md"
          >
            <span className="opacity-70">{hover.metric}</span> ·{" "}
            <span className="font-mono">{hover.series}</span>{" "}
            <span className="tnum font-mono">{hover.value.toFixed(3)}</span>
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground mt-[10px] flex flex-wrap gap-4 text-[0.76rem]">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-[6px]">
            <span
              aria-hidden
              className="inline-block size-[10px] rounded-sm"
              style={{ background: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
