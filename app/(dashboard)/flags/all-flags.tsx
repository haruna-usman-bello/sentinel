"use client";

import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { FlagList, FlagRow } from "@/components/dashboard/flag-list";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPTY_FILTERS, STATUS_LABEL, applyFilters, paginate } from "@/lib/domain";
import { FLAG_STATUSES, type Flag } from "@/lib/types";

export function AllFlags({ flags: scopedFlags }: { flags: Flag[] }) {
  const { role } = useDashboard();
  const params = useSearchParams();

  // A drill-down from the national summary or a state's LGA list arrives as a query param.
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    state: params.get("state") ?? "all",
    lga: params.get("lga") ?? "all",
  }));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const activeFilters = Object.values(filters).filter((v) => v !== "all").length;
  // The filters stay out of the way until asked for, or until a drill-down has set one.
  const [showFilters, setShowFilters] = useState(activeFilters > 0);

  const isNational = role.key === "national";

  const diseases = useMemo(() => [...new Set(scopedFlags.map((f) => f.disease))].sort(), [scopedFlags]);
  const lgas = useMemo(
    () =>
      [
        ...new Set(
          scopedFlags
            .filter((f) => filters.state === "all" || f.state === filters.state)
            .map((f) => f.lga),
        ),
      ].sort(),
    [scopedFlags, filters.state],
  );
  const states = useMemo(() => [...new Set(scopedFlags.map((f) => f.state))].sort(), [scopedFlags]);

  const matched = applyFilters(scopedFlags, filters, query);
  const pageData = paginate(matched, page);
  const narrowed = query !== "" || activeFilters > 0;

  function update(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value, ...(key === "state" ? { lga: "all" } : {}) }));
    setPage(1);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Flags" periodScoped />
      <PageBody>
        <DenialNotice />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              label="Search flags"
              placeholder="Search facility, LGA or disease"
              className="min-w-0 flex-1 basis-56 sm:max-w-80"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              aria-expanded={showFilters}
              aria-controls="flag-filters"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              Filter
              {activeFilters ? (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[0.72rem] leading-4 font-semibold">
                  {activeFilters}
                </span>
              ) : null}
            </Button>
            {narrowed ? (
              <Button variant="ghost" size="sm" className="h-9" onClick={clearAll}>
                Clear
              </Button>
            ) : null}
            <span className="text-muted-foreground ml-auto text-[0.86rem]">
              {narrowed ? `${matched.length} of ${scopedFlags.length}` : `${scopedFlags.length}`}{" "}
              {scopedFlags.length === 1 ? "flag" : "flags"}
            </span>
          </div>

          {showFilters ? (
            <div id="flag-filters" className="bg-secondary/60 flex flex-wrap items-center gap-2 rounded-lg p-2">
              <Select value={filters.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger size="sm" className="bg-card w-auto" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  {FLAG_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.disease} onValueChange={(v) => update("disease", v)}>
                <SelectTrigger size="sm" className="bg-card w-auto" aria-label="Filter by disease">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every disease</SelectItem>
                  {diseases.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isNational ? (
                <Select value={filters.state} onValueChange={(v) => update("state", v)}>
                  <SelectTrigger size="sm" className="bg-card w-auto" aria-label="Filter by state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Every state</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Select value={filters.lga} onValueChange={(v) => update("lga", v)}>
                <SelectTrigger size="sm" className="bg-card w-auto" aria-label="Filter by LGA">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every LGA</SelectItem>
                  {lgas.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          {pageData.rows.length ? (
            <FlagList>
              {pageData.rows.map((flag) => (
                <FlagRow key={flag.id} flag={flag} place={isNational ? "state" : "lga"} showStatus />
              ))}
            </FlagList>
          ) : (
            <p className="text-muted-foreground border-t py-4 text-[0.9rem]">
              {scopedFlags.length ? (
                <>
                  Nothing matches {query ? `“${query}”` : "those filters"}.{" "}
                  <button
                    type="button"
                    className="text-brand font-medium underline underline-offset-2"
                    onClick={clearAll}
                  >
                    Clear them
                  </button>
                </>
              ) : (
                "No flag has been raised up to this month."
              )}
            </p>
          )}
          <DataPager page={pageData} onPageChange={setPage} />
        </div>
      </PageBody>
    </>
  );
}
