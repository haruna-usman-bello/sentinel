"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Tag } from "@/components/dashboard/badges";
import { Panel, PanelBody, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  importFacilitiesAction,
  previewFacilityImportAction,
} from "@/lib/actions/facilities";
import {
  DEFAULT_LEVELS,
  type ImportOutcome,
  type ImportPreview,
} from "@/lib/dhis2/org-units";
import { cn } from "@/lib/utils";

const OUTCOME: Record<ImportOutcome, { label: string; tone: string; applies: boolean }> = {
  new: { label: "add", tone: "text-success", applies: true },
  remapped: { label: "attach", tone: "text-brand", applies: true },
  renamed: { label: "update", tone: "text-warning", applies: true },
  unchanged: { label: "no change", tone: "text-muted-foreground", applies: false },
  conflict: { label: "conflict", tone: "text-critical", applies: false },
};

/**
 * The facility register read from the DHIS2 organisation-unit tree. The
 * register decides the system's reach — a facility not on it is never
 * collected from — so an import is shown in full and confirmed rather than
 * applied straight from a fetch.
 */
export function FacilityImport({ configured }: { configured: boolean }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [loading, startLoad] = useTransition();
  const [applying, startApply] = useTransition();

  function load() {
    startLoad(async () => {
      const result = await previewFacilityImportAction(DEFAULT_LEVELS);
      if (result.ok) {
        setPreview(result.preview);
        setError(null);
        setSkipped(new Set());
      } else {
        setPreview(null);
        setError(result.error);
      }
    });
  }

  const rows = preview?.rows ?? [];
  const applicable = rows.filter((r) => OUTCOME[r.outcome].applies && !skipped.has(r.orgUnit));

  function apply() {
    startApply(async () => {
      const result = await importFacilitiesAction(applicable);
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        setPreview(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.outcome] = (acc[row.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Panel>
      <PanelHeader
        title="Facility register"
        description="Read from the DHIS2 organisation-unit tree, so a facility arrives with the unit it reports as already attached."
        actions={
          <Button variant="outline" size="sm" disabled={loading || !configured} onClick={load}>
            {loading ? "Reading…" : preview ? "Read again" : "Read from DHIS2"}
          </Button>
        }
      />

      {!configured ? (
        <PanelBody>
          <p className="text-muted-foreground m-0 text-[0.85rem]">
            No DHIS2 instance is configured, so there is no register to read. Set{" "}
            <span className="font-mono text-[0.78rem]">DHIS2_BASE_URL</span> and its
            credentials, or add facilities to the database directly.
          </p>
        </PanelBody>
      ) : null}

      {error ? (
        <PanelBody>
          <div
            role="alert"
            className="bg-critical-soft border-critical/40 rounded-md border px-[15px] py-[13px] text-[0.85rem]"
          >
            {error}
          </div>
        </PanelBody>
      ) : null}

      {preview ? (
        <>
          <PanelBody>
            <p className="text-muted-foreground m-0 text-[0.85rem]">
              {preview.fetched} organisation unit{preview.fetched === 1 ? "" : "s"} at level{" "}
              {preview.levels.facility}, with the state read from level {preview.levels.state} and
              the LGA from level {preview.levels.lga}.{" "}
              {Object.entries(counts)
                .map(([outcome, n]) => `${n} to ${OUTCOME[outcome as ImportOutcome].label}`)
                .join(", ")}
              . Nothing has been written yet.
            </p>
          </PanelBody>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Organisation unit</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const outcome = OUTCOME[row.outcome];
                  const isSkipped = skipped.has(row.orgUnit);
                  return (
                    <TableRow
                      key={row.orgUnit}
                      className={cn("align-top", (!outcome.applies || isSkipped) && "opacity-55")}
                    >
                      <TableCell>
                        <strong className="font-semibold">{row.name}</strong>
                        <div className="text-faint mt-[2px] font-mono text-[0.7rem]">{row.code}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.lga}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.state}</TableCell>
                      <TableCell className="font-mono text-[0.76rem]">{row.orgUnit}</TableCell>
                      <TableCell>
                        <span className={cn("text-[0.83rem] font-medium", outcome.tone)}>
                          {isSkipped ? "skipped" : outcome.label}
                        </span>
                        {row.note ? (
                          <div className="text-muted-foreground mt-[2px] max-w-[320px] text-[0.76rem]">
                            {row.note}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {outcome.applies ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSkipped((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.orgUnit)) next.delete(row.orgUnit);
                                else next.add(row.orgUnit);
                                return next;
                              })
                            }
                          >
                            {isSkipped ? "Include" : "Skip"}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {preview.rejected.length ? (
            <PanelBody>
              <div className="border-warning/45 bg-warning-soft rounded-md border px-[15px] py-[13px] text-[0.83rem]">
                <strong className="text-warning font-semibold">
                  {preview.rejected.length} unit{preview.rejected.length === 1 ? "" : "s"} could not
                  be placed and will be left out.
                </strong>
                <ul className="m-0 mt-2 list-disc space-y-1 pl-4">
                  {preview.rejected.slice(0, 6).map((r) => (
                    <li key={r.orgUnit}>
                      <span className="font-semibold">{r.name}</span> — {r.reason}
                    </li>
                  ))}
                </ul>
                {preview.rejected.length > 6 ? (
                  <div className="mt-1">…and {preview.rejected.length - 6} more.</div>
                ) : null}
              </div>
            </PanelBody>
          ) : null}

          <PanelBody>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={applying || !applicable.length} onClick={apply}>
                {applying
                  ? "Importing…"
                  : applicable.length
                    ? `Import ${applicable.length} facilit${applicable.length === 1 ? "y" : "ies"}`
                    : "Nothing to import"}
              </Button>
              <Button variant="outline" disabled={applying} onClick={() => setPreview(null)}>
                Discard
              </Button>
              {counts.conflict ? (
                <span className="text-muted-foreground text-[0.82rem]">
                  <Tag className="mr-2">conflict</Tag>
                  {counts.conflict} left out — two facilities cannot share a code. Resolve it in
                  DHIS2 or rename the one on the register.
                </span>
              ) : null}
            </div>
          </PanelBody>
        </>
      ) : null}

      <PanelFootnote>
        A facility that is not on the register is never collected from, and the detector does
        not judge it. Importing again later picks up renames and additions; it never removes a
        facility, because its flags and audit trail refer to it.
      </PanelFootnote>
    </Panel>
  );
}
