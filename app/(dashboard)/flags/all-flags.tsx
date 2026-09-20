"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { FlagsTable } from "@/components/dashboard/flags-table";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPTY_FILTERS, applyFilters, humanStatus, paginate } from "@/lib/domain";
import { FLAG_STATUSES, type Flag } from "@/lib/types";

export function AllFlags({ flags: scopedFlags }: { flags: Flag[] }) {
  const { role } = useDashboard();
  const params = useSearchParams();

  // A drill-down from the national table or a state bar arrives as a query param.
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    state: params.get("state") ?? "all",
    lga: params.get("lga") ?? "all",
  }));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const isNational = role.key === "national";

  const diseases = useMemo(
    () => [...new Set(scopedFlags.map((f) => f.disease))].sort(),
    [scopedFlags],
  );
  const lgas = useMemo(
    () => [...new Set(scopedFlags.map((f) => f.lga))].sort(),
    [scopedFlags],
  );
  const states = useMemo(
    () => [...new Set(scopedFlags.map((f) => f.state))].sort(),
    [scopedFlags],
  );

  const matched = applyFilters(scopedFlags, filters, query);
  const pageData = paginate(matched, page);

  const filtersActive =
    query !== "" || Object.values(filters).some((v) => v !== "all");

  function update(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
    setPage(1);
  }

  return (
    <>
      <PageHeader title="All flags" periodScoped />
      <PageBody>

        <DenialNotice />

        <Panel>
          <PanelHeader
            actions={
              <span className="text-muted-foreground font-mono text-[0.78rem]">
                {matched.length} of {scopedFlags.length}
              </span>
            }
          >
            <div className="flex flex-wrap items-center gap-[9px]">
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                label="Search flags"
                placeholder="Search facility, ID, LGA, state, disease…"
              />

              <Select
                value={filters.disease}
                onValueChange={(v) => update("disease", v)}
              >
                <SelectTrigger size="sm" className="w-auto" aria-label="Filter by disease">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All diseases</SelectItem>
                  {diseases.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger size="sm" className="w-auto" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  {FLAG_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {humanStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isNational ? (
                <Select value={filters.state} onValueChange={(v) => update("state", v)}>
                  <SelectTrigger size="sm" className="w-auto" aria-label="Filter by state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Select value={filters.lga} onValueChange={(v) => update("lga", v)}>
                <SelectTrigger size="sm" className="w-auto" aria-label="Filter by LGA">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All LGAs</SelectItem>
                  {lgas.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filtersActive ? (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear
                </Button>
              ) : null}
            </div>
          </PanelHeader>

          <FlagsTable
            flags={pageData.rows}
            showState={isNational}
            empty={
              <>
                Nothing matches {query ? `“${query}”` : "those filters"}.{" "}
                <button
                  type="button"
                  className="text-brand underline underline-offset-2"
                  onClick={clearAll}
                >
                  Clear them
                </button>
              </>
            }
          />

          <DataPager page={pageData} onPageChange={setPage} />
        </Panel>
      </PageBody>
    </>
  );
}
