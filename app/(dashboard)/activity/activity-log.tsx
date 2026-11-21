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

const KINDS: { kind: ActivityKind | "all"; label: string }[] = [
  { kind: "all", label: "Everything" },
  { kind: "flag", label: "Flags" },
  { kind: "account", label: "Accounts" },
  { kind: "config", label: "Settings" },
  { kind: "auth", label: "Sign-ins" },
];

export function ActivityLog({ activity }: { activity: ActivityEntry[] }) {
  const { role } = useDashboard();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const rows = activity.filter(
    (a) =>
      (kind === "all" || a.kind === kind) &&
      (!q || [a.actor, a.action, a.detail].join(" ").toLowerCase().includes(q)),
  );
  const narrowed = q !== "" || kind !== "all";

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
              {kind !== "all" ? (
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
              {KINDS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  aria-pressed={kind === option.kind}
                  onClick={() => {
                    setKind(option.kind);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[0.86rem] transition-colors",
                    kind === option.kind
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-secondary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
