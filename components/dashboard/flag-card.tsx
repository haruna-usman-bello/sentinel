import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { shortDate, signalLine } from "@/lib/domain";
import type { Flag } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One flag on a worklist or queue: what happened in plain words, where it
 * stands, and underneath the one line that matters to whoever is reading.
 * That line and the buttons are the page's to choose, since they depend on
 * whose list it is.
 */
export function FlagCard({
  flag,
  note,
  actions,
}: {
  flag: Flag;
  note?: React.ReactNode;
  actions: React.ReactNode;
}) {
  // Dismissed and closed flags are settled; a confirmed outbreak is not.
  const settled = flag.status === "false_alarm" || flag.status === "closed";
  const hot = flag.type === "statistical" && (flag.z ?? 0) >= 3;

  return (
    <article
      className={cn(
        "bg-card border-border grid grid-cols-1 items-start gap-[14px] rounded-md border border-l-[3px] px-[17px] py-[15px] sm:grid-cols-[1fr_auto]",
        settled ? "border-l-success" : hot ? "border-l-critical" : "border-l-warning",
      )}
    >
      <div className="min-w-0">
        <div className={cn("font-heading text-[0.98rem] font-semibold", settled && "opacity-80")}>
          {flag.facilityName} — {flag.disease}
        </div>
        <div className="text-muted-foreground mt-[3px] text-[0.85rem]">{signalLine(flag)}</div>
        <div className="mt-[9px] flex flex-wrap items-center gap-2">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-faint font-mono text-[0.72rem]">Raised {shortDate(flag.raisedAt)}</span>
        </div>
        {note ? (
          <p className="border-line-soft text-muted-foreground mt-[9px] border-t border-dashed pt-2 text-[0.8rem]">
            {note}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:max-w-[280px] sm:justify-end">{actions}</div>
    </article>
  );
}

function GroupTitle({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[1.15rem] font-semibold">
      {children}
      <span className="border-border text-muted-foreground rounded-full border px-[7px] font-mono text-[0.7rem] leading-[1.6] font-medium">
        {count}
      </span>
    </h2>
  );
}

/** A titled group of cards, with what to say when it is empty. */
export function FlagGroup({
  title,
  description,
  count,
  empty,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <GroupTitle count={count}>{title}</GroupTitle>
        {description ? (
          <p className="text-muted-foreground mt-[2px] text-[0.83rem]">{description}</p>
        ) : null}
      </div>
      {count ? children : <p className="text-muted-foreground text-[0.83rem]">{empty}</p>}
    </section>
  );
}

/** A group folded away by default: it only grows, and nothing in it needs the reader. */
export function FoldedFlagGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <GroupTitle count={count}>{title}</GroupTitle>
        <span className="text-muted-foreground text-[0.8rem] group-open:hidden">Show</span>
        <span className="text-muted-foreground hidden text-[0.8rem] group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {count ? children : <p className="text-muted-foreground text-[0.83rem]">{empty}</p>}
      </div>
    </details>
  );
}
