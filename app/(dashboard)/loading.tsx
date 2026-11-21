import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a dashboard link is clicked, while the next screen's data
 * is fetched. Without it the router holds the previous page on screen until
 * the server replies, so a click appears to do nothing — which on a database
 * a few hundred miles away is a third of a second of apparently broken UI.
 *
 * It mirrors the shape every screen shares — a title, an opening sentence,
 * a list of rows — so the layout does not jump when the real content arrives.
 */
export default function Loading() {
  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
        <div className="min-w-[200px] flex-1">
          <Skeleton className="h-8 w-[240px]" />
        </div>
        <Skeleton className="h-8 w-[190px] rounded-full" />
      </div>

      <div className="flex max-w-[1120px] flex-col gap-7 px-4 pt-3 pb-10 sm:px-6">
        <div className="flex max-w-[68ch] flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-5 w-[180px]" />
          <div className="border-t">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-line-soft flex items-center gap-6 border-b px-1 py-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-3 w-[30%]" />
                </div>
                <Skeleton className="hidden h-2 w-44 rounded-full sm:block" />
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
