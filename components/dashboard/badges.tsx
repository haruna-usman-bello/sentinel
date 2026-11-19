import { STATUS_LABEL } from "@/lib/domain";
import type { ActivityKind, FlagStatus, FlagType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_TEXT = {
  critical: "text-critical",
  warning: "text-warning",
  success: "text-success",
  brand: "text-brand",
  neutral: "text-neutral-badge",
} as const;

type Tone = keyof typeof TONE_TEXT;

/** A state said as a coloured dot and a plain word, in sentence case. */
export function Status({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.82rem] font-medium whitespace-nowrap",
        TONE_TEXT[tone],
        className,
      )}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
      <span>{children}</span>
    </span>
  );
}

const STATUS_TONE: Record<FlagStatus, Tone> = {
  pending: "warning",
  investigating: "brand",
  confirmed: "critical",
  false_alarm: "neutral",
  closed: "success",
};

/** Where a flag stands, named as the sections that group flags name it. */
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
    <Status tone={STATUS_TONE[status]} className={className}>
      {label ?? STATUS_LABEL[status]}
    </Status>
  );
}

/** A state that is not a flag's status, coloured by what it means. */
export function TonePill({
  tone,
  children,
}: {
  tone: "critical" | "warning" | "success";
  children: React.ReactNode;
}) {
  return <Status tone={tone}>{children}</Status>;
}

/** What kind of signal a flag is. A missing report is outlined, not filled: it is an absence. */
export function SignalTag({ type }: { type: FlagType }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-px text-[0.78rem] font-medium whitespace-nowrap",
        type === "statistical"
          ? "bg-critical-soft text-critical"
          : "text-warning border-warning/50 border border-dashed",
      )}
    >
      {type === "statistical" ? "Unusual rise" : "No report"}
    </span>
  );
}

/** A quiet label, such as a disease name in a list. */
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
        "bg-secondary text-muted-foreground inline-block rounded-full px-2 py-px text-[0.78rem] whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

const KIND: Record<ActivityKind, { label: string; tone: Tone }> = {
  auth: { label: "Sign-in", tone: "brand" },
  config: { label: "Settings", tone: "warning" },
  account: { label: "Accounts", tone: "success" },
  flag: { label: "Flags", tone: "critical" },
};

export function ActivityKindTag({ kind }: { kind: ActivityKind }) {
  return <Status tone={KIND[kind].tone}>{KIND[kind].label}</Status>;
}
