import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** A bordered surface, kept for things that are one object: a form, a table, a chart. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card min-w-0 rounded-xl border", className)}>{children}</section>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn("flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5", className)}
    >
      {children ?? (
        <div className="min-w-0">
          {title ? <h2 className="text-[1rem] font-semibold">{title}</h2> : null}
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-[0.85rem]">{description}</p>
          ) : null}
        </div>
      )}
      {actions}
    </header>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-4 sm:px-5", className)}>{children}</div>;
}

/** Two columns that collapse to one below ~640px of available width. */
export function Grid2({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KeyValue({
  items,
  className,
}: {
  items: { term: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-5 gap-y-1 text-[0.9rem] sm:grid-cols-[minmax(7rem,auto)_1fr] sm:gap-y-2.5",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.term} className="contents">
          <dt className="text-muted-foreground pt-px text-[0.85rem] max-sm:mt-2 max-sm:first:mt-0">
            {item.term}
          </dt>
          <dd className="m-0">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A section heading with its count, and a line saying what the section is for. */
export function SectionHeading({
  title,
  count,
  hint,
  actions,
}: {
  title: React.ReactNode;
  count?: number;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-2 text-[1.05rem] font-semibold">
          {title}
          {count !== undefined ? (
            <span className="text-faint text-[0.85rem] font-semibold">{count}</span>
          ) : null}
        </h2>
        {hint ? <p className="text-muted-foreground mt-0.5 text-[0.86rem]">{hint}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/**
 * Detail on request: a row that opens to show what most visits do not need.
 * Built on <details>, so it works before any script has loaded.
 */
export function Disclosure({
  title,
  count,
  note,
  defaultOpen = false,
  className,
  children,
}: {
  title: React.ReactNode;
  count?: number;
  /** A short line at the right of the closed row: what is inside, or the latest of it. */
  note?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn("group/disclosure border-t", className)}>
      <summary className="hover:bg-secondary/60 focus-visible:ring-ring/50 flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-3 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="text-faint size-4 shrink-0 transition-transform group-open/disclosure:rotate-90 motion-reduce:transition-none"
        />
        <span className="text-[0.95rem] font-semibold">{title}</span>
        {count !== undefined ? (
          <span className="text-faint text-[0.85rem] font-semibold">{count}</span>
        ) : null}
        {note ? (
          <span className="text-muted-foreground ml-auto truncate pl-3 text-[0.84rem]">{note}</span>
        ) : null}
      </summary>
      <div className="pb-4 pl-1 sm:pl-7">{children}</div>
    </details>
  );
}
