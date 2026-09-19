import { cn } from "@/lib/utils";
import { humanStatus } from "@/lib/domain";
import type { ActivityKind, FlagStatus, FlagType } from "@/lib/types";

const PILL_BASE =
  "inline-block rounded-full px-2 py-[3px] font-mono text-[0.64rem] font-medium tracking-[0.06em] whitespace-nowrap uppercase";

const STATUS_TONE: Record<FlagStatus, string> = {
  pending: "bg-warning-soft text-warning",
  investigating: "bg-brand-soft text-brand",
  confirmed: "bg-critical-soft text-critical",
  false_alarm: "bg-neutral-soft text-neutral-badge",
  closed: "bg-success-soft text-success",
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: FlagStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, STATUS_TONE[status], className)}>
      {label ?? humanStatus(status)}
    </span>
  );
}

/** Non-reporting is dashed: the signal is an absence, not a measurement. */
export function SignalTag({ type }: { type: FlagType }) {
  return (
    <span
      className={cn(
        "inline-block rounded-[3px] border px-[7px] py-[2px] font-mono text-[0.62rem] whitespace-nowrap",
        type === "statistical"
          ? "border-critical/35 text-critical"
          : "border-dashed border-warning/40 text-warning",
      )}
    >
      {type === "statistical" ? "Unusual rise" : "No report"}
    </span>
  );
}

export function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border text-muted-foreground inline-block rounded-[3px] border px-[7px] py-[2px] font-mono text-[0.62rem] whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

const SEVERITY_TONE = {
  hi: "bg-critical",
  md: "bg-warning",
  lo: "bg-success",
} as const;

/** The 3px rule that carries severity beside a facility name. */
export function SeverityRule({
  level,
  className,
}: {
  level: keyof typeof SEVERITY_TONE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "mr-[7px] inline-block h-[1.05em] w-[3px] rounded-sm align-[-2px]",
        SEVERITY_TONE[level],
        className,
      )}
    />
  );
}

const KIND_TONE: Record<ActivityKind, string> = {
  auth: "border-brand/40 text-brand",
  config: "border-warning/45 text-warning",
  account: "border-success/45 text-success",
  flag: "border-critical/40 text-critical",
};

export function ActivityKindTag({ kind }: { kind: ActivityKind }) {
  return (
    <span
      className={cn(
        "inline-block rounded-[3px] border px-[7px] py-[2px] font-mono text-[0.6rem] tracking-[0.07em] whitespace-nowrap uppercase",
        KIND_TONE[kind],
      )}
    >
      {kind}
    </span>
  );
}
