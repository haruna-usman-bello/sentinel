"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { ActivityKindTag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { paginate, stampLabel } from "@/lib/domain";
import type { ActivityEntry, ActivityKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What the log shows: everything but routine sign-ins (the default), everything, or one kind. */
type View = "events" | "all" | ActivityKind;

const VIEWS: { view: View; label: string }[] = [
  { view: "events", label: "All but routine sign-ins" },
  { view: "all", label: "Everything" },
  { view: "flag", label: "Flags" },
  { view: "account", label: "Accounts" },
  { view: "config", label: "Settings" },
  { view: "auth", label: "Sign-ins" },
];

/**
 * A successful sign-in is by far the commonest entry and the least telling,
 * so it is out of the way by default. Failed sign-ins, password changes and
 * signing out other devices are sign-in events too, but they matter, so they
 * stay in view.
 */
const isRoutine = (entry: ActivityEntry) => entry.kind === "auth" && entry.action === "Signed in";

export function ActivityLog({ activity }: { activity: ActivityEntry[] }) {
  const { role } = useDashboard();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("events");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const matches = (a: ActivityEntry) =>
    !q || [a.actor, a.action, a.detail].join(" ").toLowerCase().includes(q);
  const rows = activity.filter(
    (a) =>
      (view === "all" || (view === "events" ? !isRoutine(a) : a.kind === view)) && matches(a),
  );
  const hiddenSignIns = view === "events" ? activity.filter((a) => isRoutine(a) && matches(a)).length : 0;
  const narrowed = q !== "" || view !== "all";

  function choose(next: View) {
    setView(next);
    setPage(1);
  }

  const pageData = paginate(rows, page);

  return (
    <>
      <PageHeader title={role.key === "sysadmin" ? "System activity" : "Activity log"} />
      <PageBody>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              label="Search activity"
              placeholder="Search person, action or detail"
              className="min-w-0 flex-1 basis-56 sm:max-w-80"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              aria-expanded={showFilters}
              aria-controls="activity-filters"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              Filter
              {view !== "events" ? (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[0.72rem] leading-4 font-semibold">
                  1
                </span>
              ) : null}
            </Button>
            <span className="text-muted-foreground ml-auto text-[0.86rem]">
              {narrowed ? `${rows.length} of ${activity.length}` : activity.length}{" "}
              {activity.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {showFilters ? (
            <div id="activity-filters" role="group" aria-label="Kind of activity" className="flex flex-wrap gap-1.5">
              {VIEWS.map((option) => (
                <button
                  key={option.view}
                  type="button"
                  aria-pressed={view === option.view}
                  onClick={() => choose(option.view)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[0.86rem] transition-colors",
                    view === option.view
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-secondary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {hiddenSignIns ? (
            <p className="text-muted-foreground text-[0.86rem]">
              {hiddenSignIns} routine {hiddenSignIns === 1 ? "sign-in is" : "sign-ins are"} hidden.{" "}
              <button
                type="button"
                onClick={() => choose("all")}
                className="text-brand font-medium underline-offset-[3px] hover:underline"
              >
                Show them
              </button>
            </p>
          ) : null}
        </div>

        <div>
          {pageData.rows.length ? (
            <ul className="@container m-0 list-none border-t p-0">
              {pageData.rows.map((entry) => (
                <li
                  key={entry.id}
                  className="border-line-soft grid grid-cols-1 gap-x-5 gap-y-1 border-b px-1 py-3 @xl:grid-cols-[minmax(0,1fr)_7rem] @xl:items-start"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.93rem] font-semibold">{entry.action}</span>
                    {entry.detail ? (
                      <span className="text-[0.88rem]">{entry.detail}</span>
                    ) : null}
                    <span className="text-muted-foreground text-[0.84rem]">
                      {entry.actor}, {stampLabel(entry.at)}
                    </span>
                  </span>
                  <span className="@xl:justify-self-end">
                    <ActivityKindTag kind={entry.kind} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground border-t py-3 text-[0.9rem]">
              {activity.length ? "Nothing matches that search." : "Nothing has been recorded yet."}
            </p>
          )}
          <DataPager page={pageData} onPageChange={setPage} />
        </div>

        <p className="text-muted-foreground text-[0.86rem]">
          Entries are never edited or removed.
          {role.key === "state" ? " You see activity in your state and events that affect the whole system." : ""}
        </p>
      </PageBody>
    </>
  );
}
