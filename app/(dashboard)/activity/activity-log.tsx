"use client";

import { useState } from "react";

import { ActivityKindTag } from "@/components/dashboard/badges";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paginate } from "@/lib/domain";
import type { ActivityEntry } from "@/lib/types";

export function ActivityLog({ activity }: { activity: ActivityEntry[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const rows = activity.filter(
    (a) => !q || [a.actor, a.action, a.detail, a.kind].join(" ").toLowerCase().includes(q),
  );

  const pageData = paginate(rows, page);

  return (
    <>
      <PageHeader title="System activity" />
      <PageBody>

        <Panel>
          <PanelHeader
            actions={
              <span className="text-muted-foreground font-mono text-[0.78rem]">
                {rows.length} entr{rows.length === 1 ? "y" : "ies"}
              </span>
            }
          >
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              label="Search activity"
              placeholder="Search person, action, detail…"
            />
          </PanelHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground text-[0.83rem]"
                    >
                      Nothing matches that search.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.rows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {entry.at}
                      </TableCell>
                      <TableCell>
                        <ActivityKindTag kind={entry.kind} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <strong className="font-semibold">{entry.actor}</strong>
                      </TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell className="text-muted-foreground text-[0.82rem]">
                        {entry.detail}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPager page={pageData} onPageChange={setPage} />

          <PanelFootnote>
            Append-only. Entries are never edited or removed, and a state coordinator sees
            only activity affecting their own state plus system-wide events.
          </PanelFootnote>
        </Panel>
      </PageBody>
    </>
  );
}
