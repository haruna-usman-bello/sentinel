"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
        className="h-8 w-[172px] font-mono text-[0.84rem]"
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
      {error ? <p className="text-critical max-w-[260px] text-[0.82rem]">{error}</p> : null}
    </div>
  );
}

/** Step three: which DHIS2 data element holds each disease's monthly cases. */
export function DiseaseMappingFields({ diseases }: { diseases: DiseaseMapping[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-5">
        {diseases.map((disease) => (
          <div key={disease.id} className="flex flex-col gap-1.5">
            <label htmlFor={`de-${disease.id}`} className="text-[0.88rem] font-medium">
              {disease.name}
            </label>
            <MappingField
              id={`de-${disease.id}`}
              initial={disease.dataElement}
              placeholder="e.g. FTRrcoaog83"
              save={(dataElement) => setDiseaseMappingAction({ diseaseId: disease.id, dataElement })}
            />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground max-w-[72ch] text-[0.86rem]">
        Each is the 11-character DHIS2 ID of the data element, as the maintenance app shows it. A
        field saves when you leave it.
      </p>
    </div>
  );
}

/**
 * Step four: the organisation unit each facility reports as. A pull covers only
 * linked facilities, so the unlinked come first.
 */
export function FacilityMappingList({ facilities }: { facilities: FacilityMapping[] }) {
  const unlinked = facilities.filter((f) => !f.orgUnit);
  const [showAll, setShowAll] = useState(unlinked.length === 0);
  const rows = showAll
    ? [...unlinked, ...facilities.filter((f) => f.orgUnit)]
    : unlinked.slice(0, 25);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground max-w-[72ch] text-[0.86rem]">
        Nothing is collected from a facility without one, and the detector does not judge it.
        Clearing an ID takes the facility out of the pull; its history stays.
      </p>
      {facilities.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead>LGA</TableHead>
                <TableHead>Organisation unit</TableHead>
                <TableHead>Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((facility) => (
                <TableRow key={facility.id} className="align-top">
                  <TableCell>
                    <strong className="font-semibold">{facility.name}</strong>
                    <div className="text-muted-foreground text-[0.8rem]">
                      {facility.state}, code {facility.code}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{facility.lga}</TableCell>
                  <TableCell>
                    <MappingField
                      id={`ou-${facility.id}`}
                      initial={facility.orgUnit}
                      placeholder="e.g. DiszpKrYNg8"
                      save={(orgUnit) => setFacilityMappingAction({ facilityId: facility.id, orgUnit })}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {facility.months ? `${facility.months} month${facility.months === 1 ? "" : "s"}` : "Nothing yet"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground text-[0.88rem]">No facility is on the register yet.</p>
      )}
      {!showAll && rows.length < facilities.length ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            {unlinked.length > rows.length
              ? `Show all ${facilities.length} facilities`
              : `Show the ${facilities.length - unlinked.length} already linked too`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
