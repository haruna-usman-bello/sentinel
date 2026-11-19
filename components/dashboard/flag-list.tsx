import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/dashboard/badges";
import { Disclosure, SectionHeading } from "@/components/dashboard/panel";
import { monthLabel } from "@/lib/domain";
import type { Flag } from "@/lib/types";
import { cn } from "@/lib/utils";

/** How many times the usual level the bar's full length stands for. */
const FULL_SCALE = 4;

/**
 * A flag's signal at a glance: this month's count against the facility's usual
 * level, on one scale for every row. The tick marks the usual level, a quarter
 * of the way along, so the bar's length reads as "how many times usual", up to
 * four. A missing report is an empty dashed track: there is nothing to measure.
 * The plain-language line beneath says the same in words.
 */
export function SignalBar({
  flag,
  className,
}: {
  flag: Pick<Flag, "type" | "cases" | "usual" | "period">;
  className?: string;
}) {
  if (flag.type === "non_reporting") {
    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <span aria-hidden className="border-warning block h-2 w-full max-w-52 rounded-full border-[1.5px] border-dashed" />
        <span className="text-muted-foreground text-[0.82rem]">No report for {monthLabel(flag.period)}</span>
      </div>
    );
  }

  const cases = flag.cases ?? 0;
  const usual = flag.usual;
  const ratio = usual === undefined ? null : usual > 0 ? cases / usual : FULL_SCALE;
  const words =
    usual === undefined ? `${cases} cases` : `${cases} cases, usually about ${Math.round(usual)}`;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {ratio !== null ? (
        <span
          role="img"
          aria-label={`${cases} cases, ${ratio >= FULL_SCALE ? "four or more" : ratio.toFixed(1)} times the usual level`}
          className="bg-secondary relative block h-2 w-full max-w-52 rounded-full"
        >
          <span
            className="bg-critical absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(ratio / FULL_SCALE, 1) * 100}%` }}
          />
          <span className="bg-foreground absolute -inset-y-1 left-1/4 w-0.5 -translate-x-1/2 rounded-full" />
        </span>
      ) : null}
      <span className="text-muted-foreground text-[0.82rem]">{words}</span>
    </div>
  );
}

/** What a row says under the flag's name: where, when, and optionally where it stands. */
function RowText({
  flag,
  place,
  showStatus,
  note,
  titleLink,
}: {
  flag: Flag;
  place: "none" | "lga" | "state";
  showStatus: boolean;
  note?: React.ReactNode;
  titleLink?: string;
}) {
  const title = `${flag.disease} at ${flag.facilityName}`;
  const where =
    place === "lga" ? `${flag.lga} LGA` : place === "state" ? `${flag.lga} LGA, ${flag.state}` : null;
  return (
    <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-0.5">
      {titleLink ? (
        <Link href={titleLink} className="text-[0.95rem] font-semibold underline-offset-[3px] hover:underline">
          {title}
        </Link>
      ) : (
        <span className="text-[0.95rem] font-semibold">{title}</span>
      )}
      <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.84rem]">
        <span>{[where, monthLabel(flag.period)].filter(Boolean).join(", ")}</span>
        {showStatus ? <StatusPill status={flag.status} /> : null}
      </span>
      {note ? <p className="text-muted-foreground mt-1 text-[0.85rem]">{note}</p> : null}
    </div>
  );
}

/**
 * One flag in a list. Without `actions` the whole row opens the flag, where the
 * evidence and the decision sit together. With them, the title opens it and the
 * buttons act in place, as on the officer's worklist and the supervisor's queue.
 */
export function FlagRow({
  flag,
  place = "lga",
  showStatus = false,
  note,
  actions,
  href,
  actionColumn = false,
}: {
  flag: Flag;
  place?: "none" | "lga" | "state";
  showStatus?: boolean;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  href?: string;
  /** Keep a column for buttons even on a row without any, so bars line up down a list that mixes both. */
  actionColumn?: boolean;
}) {
  const target = href ?? `/flags/${flag.id}`;
  const columns = actionColumn || actions
    ? "@xl:grid-cols-[minmax(0,1fr)_12rem_11rem]"
    : "@xl:grid-cols-[minmax(0,1fr)_12rem_auto]";

  if (actions) {
    return (
      <li className="border-line-soft border-b">
        <div className={cn("grid grid-cols-1 gap-x-5 gap-y-2.5 px-1 py-3.5 @xl:items-center", columns)}>
          <RowText flag={flag} place={place} showStatus={showStatus} note={note} titleLink={target} />
          <SignalBar flag={flag} className="@xl:col-start-2 @xl:row-start-1" />
          <div className="flex flex-wrap items-center gap-2 @xl:col-start-3 @xl:row-start-1 @xl:justify-end">
            {actions}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="border-line-soft border-b">
      <Link
        href={target}
        className={cn(
          "hover:bg-secondary/60 focus-visible:ring-ring/50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 rounded-md px-1 py-3.5 outline-none focus-visible:ring-[3px]",
          columns,
        )}
      >
        <RowText flag={flag} place={place} showStatus={showStatus} note={note} />
        <SignalBar flag={flag} className="col-start-1 row-start-2 @xl:col-start-2 @xl:row-start-1" />
        <ChevronRight
          aria-hidden
          className="text-faint col-start-2 row-span-2 row-start-1 size-4 justify-self-end @xl:col-start-3 @xl:row-span-1"
        />
      </Link>
    </li>
  );
}

/** The list rows sit in: rules between them, stacking when the column is narrow. */
export function FlagList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("@container m-0 list-none border-t p-0", className)}>{children}</ul>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground border-t py-3 text-[0.9rem]">{children}</p>;
}

/** A titled group of flags waiting on the same thing, with what to say when it is empty. */
export function FlagGroup({
  title,
  hint,
  count,
  empty,
  actions,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  count: number;
  empty: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading title={title} count={count} hint={hint} actions={actions} />
      {count ? <FlagList>{children}</FlagList> : <Empty>{empty}</Empty>}
    </section>
  );
}

/** A group folded away by default: it only grows, and nothing in it needs the reader now. */
export function FoldedFlagGroup({
  title,
  count,
  note,
  empty,
  children,
}: {
  title: string;
  count: number;
  note?: React.ReactNode;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Disclosure title={title} count={count} note={note}>
      {count ? <FlagList>{children}</FlagList> : <p className="text-muted-foreground text-[0.9rem]">{empty}</p>}
    </Disclosure>
  );
}
