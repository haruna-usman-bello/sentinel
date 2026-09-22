"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel, PanelBody, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  setDiseaseMappingAction,
  setFacilityMappingAction,
} from "@/lib/actions/mapping";
import type { ActionResult } from "@/lib/actions/shared";
import type { DiseaseMapping, FacilityMapping } from "@/lib/queries/system";

/**
 * One editable identifier. It saves on blur or Enter and says nothing when
 * nothing changed, so the administrator can tab through a long list.
 */
function MappingField({
  id,
  initial,
  placeholder,
  save,
}: {
  id: string;
  initial: string;
  placeholder: string;
  save: (value: string) => Promise<ActionResult>;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit() {
    const next = value.trim();
    if (next === saved) return;
    startTransition(async () => {
      const result = await save(next);
      if (result.ok) {
        setSaved(next);
        setError(null);
        if (result.message !== "No change to save.") {
          toast.success(result.message, { description: result.description });
        }
      } else {
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={value}
        disabled={pending}
        aria-invalid={!!error}
        aria-label="DHIS2 identifier"
        placeholder={placeholder}
        className="h-8 w-[172px] font-mono text-[0.78rem]"
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(saved);
            setError(null);
          }
        }}
      />
      {error ? <p className="text-critical max-w-[260px] text-[0.75rem]">{error}</p> : null}
    </div>
  );
}

export function Dhis2Mapping({
  facilities,
  diseases,
}: {
  facilities: FacilityMapping[];
  diseases: DiseaseMapping[];
}) {
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);
  const mapped = facilities.filter((f) => f.orgUnit).length;
  const rows = onlyUnmapped ? facilities.filter((f) => !f.orgUnit) : facilities;

  return (
    <Panel>
      <PanelHeader
        title="DHIS2 mapping"
        description="A pull covers the facilities that carry an organisation unit. Nothing is collected from the rest, and the detector does not judge them."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-[0.78rem]">
              {mapped} of {facilities.length} mapped
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOnlyUnmapped((v) => !v)}
              aria-pressed={onlyUnmapped}
            >
              {onlyUnmapped ? "Show all" : "Show unmapped"}
            </Button>
          </div>
        }
      />

      <PanelBody>
        <div className="flex flex-wrap items-end gap-5">
          {diseases.map((disease) => (
            <div key={disease.id} className="flex flex-col gap-1">
              <label
                htmlFor={`de-${disease.id}`}
                className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
              >
                {disease.name} — data element
              </label>
              <MappingField
                id={`de-${disease.id}`}
                initial={disease.dataElement}
                placeholder="e.g. FTRrcoaog83"
                save={(dataElement) =>
                  setDiseaseMappingAction({ diseaseId: disease.id, dataElement })
                }
              />
            </div>
          ))}
        </div>
      </PanelBody>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facility</TableHead>
              <TableHead>LGA</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Organisation unit</TableHead>
              <TableHead>Collected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-[0.83rem]">
                  Every facility is mapped.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((facility) => (
                <TableRow key={facility.id} className="align-top">
                  <TableCell>
                    <strong className="font-semibold">{facility.name}</strong>
                    <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                      {facility.code}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{facility.lga}</TableCell>
                  <TableCell className="whitespace-nowrap">{facility.state}</TableCell>
                  <TableCell>
                    <MappingField
                      id={`ou-${facility.id}`}
                      initial={facility.orgUnit}
                      placeholder="e.g. DiszpKrYNg8"
                      save={(orgUnit) =>
                        setFacilityMappingAction({ facilityId: facility.id, orgUnit })
                      }
                    />
                  </TableCell>
                  <TableCell className="tnum font-mono text-[0.78rem] whitespace-nowrap">
                    {facility.months
                      ? `${facility.months} month${facility.months === 1 ? "" : "s"}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PanelFootnote>
        Identifiers are the 11-character DHIS2 UIDs, as they appear in the maintenance
        app. Clearing one takes the facility out of the pull; its history stays.
      </PanelFootnote>
    </Panel>
  );
}
