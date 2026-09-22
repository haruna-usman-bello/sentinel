import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a dashboard link is clicked, while the next screen's data
 * is fetched. Without it the router holds the previous page on screen until
 * the server replies, so a click appears to do nothing — which on a database
 * a few hundred miles away is a third of a second of apparently broken UI.
 *
 * It mirrors the shape every screen shares — a header, a row of figures, a
 * panel — so the layout does not jump when the real content arrives.
 */
export default function Loading() {
  return (
    <>
      <div className="no-print bg-card border-border flex flex-wrap items-center gap-4 border-b px-4 py-[14px] sm:px-6">
        <div className="min-w-[200px] flex-1">
          <Skeleton className="h-8 w-[280px]" />
        </div>
        <Skeleton className="h-9 w-[210px] rounded-full" />
        <Skeleton className="h-9 w-[124px]" />
      </div>

      <div className="flex max-w-[1180px] flex-col gap-[22px] px-4 py-6 sm:px-6">
        <div className="bg-card border-border overflow-hidden rounded-md border">
          <div className="-mr-px -mb-px flex flex-wrap">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border min-w-[148px] flex-1 border-r border-b px-[15px] py-[13px]"
              >
                <Skeleton className="h-7 w-16" />
                <Skeleton className="mt-[9px] h-3 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border-border rounded-md border">
          <div className="border-line-soft border-b px-4 py-3">
            <Skeleton className="h-5 w-[220px]" />
          </div>
          <div className="flex flex-col gap-4 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
