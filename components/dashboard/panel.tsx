import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("bg-card border-border rounded-md border", className)}
    >
      {children}
    </section>
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
      className={cn(
        "border-line-soft flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
        className,
      )}
    >
      {children ?? (
        <div className="min-w-0">
          {title ? <h3 className="text-[0.95rem] font-semibold">{title}</h3> : null}
          {description ? (
            <p className="text-muted-foreground mt-[3px] text-[0.8rem]">{description}</p>
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
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function PanelFootnote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-secondary border-line-soft text-muted-foreground border-t px-[14px] py-[10px] text-[0.78rem]">
      {children}
    </div>
  );
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
        "grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4",
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
        "grid grid-cols-[auto_1fr] gap-x-4 gap-y-[6px] text-[0.85rem]",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.term} className="contents">
          <dt className="text-faint pt-[3px] font-mono text-[0.66rem] tracking-[0.08em] uppercase">
            {item.term}
          </dt>
          <dd className="m-0">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
