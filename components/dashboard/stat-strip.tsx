import { cn } from "@/lib/utils";

export interface StatItem {
  value: React.ReactNode;
  label: string;
  tone?: "critical" | "warning" | "success";
}

const TONE: Record<NonNullable<StatItem["tone"]>, string> = {
  critical: "text-critical",
  warning: "text-warning",
  success: "text-success",
};

/**
 * A row of headline numbers. These are hero figures, not a chart — the value
 * carries the magnitude and the label names it, so no mark is needed.
 */
export function StatStrip({
  items,
  className,
}: {
  items: StatItem[];
  className?: string;
}) {
  return (
    <div
      className={cn("bg-card border-border overflow-hidden rounded-md border", className)}
    >
      {/* Wrapping flex, not grid: a lone item on the last row stretches rather than leaving a hole. */}
      <div className="-mr-px -mb-px flex flex-wrap">
        {items.map((item) => (
          <div
            key={item.label}
            className="border-border min-w-[148px] flex-1 border-r border-b px-[15px] py-[13px]"
          >
            <div
              className={cn(
                "font-heading tnum text-[1.7rem] leading-[1.05] font-semibold",
                item.tone && TONE[item.tone],
              )}
            >
              {item.value}
            </div>
            <div className="text-faint mt-1 font-mono text-[0.62rem] tracking-[0.09em] uppercase">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
