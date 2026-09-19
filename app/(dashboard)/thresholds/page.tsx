"use client";

import { useState } from "react";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { alertLevelSchema, fieldErrors } from "@/lib/validation";

export default function ThresholdsPage() {
  return (
    <RoleGate allow={["national"]}>
      <AlertLevels />
    </RoleGate>
  );
}

function AlertLevels() {
  const { thresholds, flags, setAlertLevel } = useDashboard();

  const [disease, setDisease] = useState(thresholds[0]?.disease ?? "");
  const [k, setK] = useState("2.0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = alertLevelSchema.safeParse({ disease, k });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setAlertLevel(parsed.data.disease, parsed.data.k);
  }

  return (
    <>
      <PageHeader title="Alert levels" />
      <PageBody>

        <Panel>
          <PanelHeader
            title="Current alert levels"
            description="How far above a facility’s usual level a month must rise before it is flagged."
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disease</TableHead>
                  <TableHead>Alert level</TableHead>
                  <TableHead>Flags raised</TableHead>
                  <TableHead>Last set by</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((t) => (
                  <TableRow key={t.disease}>
                    <TableCell>
                      <strong className="font-semibold">{t.disease}</strong>
                    </TableCell>
                    <TableCell className="tnum font-mono">{t.k.toFixed(1)}×</TableCell>
                    <TableCell className="tnum font-mono">
                      {
                        flags.filter(
                          (f) => f.disease === t.disease && f.type === "statistical",
                        ).length
                      }
                    </TableCell>
                    <TableCell>{t.setBy}</TableCell>
                    <TableCell className="tnum font-mono whitespace-nowrap">
                      {t.setAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PanelBody className="border-line-soft border-t">
            <form onSubmit={submit} className="flex flex-wrap items-end gap-[9px]">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="disease"
                  className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
                >
                  Disease
                </Label>
                <Select value={disease} onValueChange={setDisease}>
                  <SelectTrigger id="disease" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {thresholds.map((t) => (
                      <SelectItem key={t.disease} value={t.disease}>
                        {t.disease}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="alert-level"
                  className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
                >
                  New alert level
                </Label>
                <Input
                  id="alert-level"
                  value={k}
                  onChange={(e) => {
                    setK(e.target.value);
                    if (errors.k) setErrors({});
                  }}
                  aria-invalid={!!errors.k}
                  className="w-24"
                  inputMode="decimal"
                />
              </div>

              <Button type="submit">Update alert level</Button>

              {errors.k ? (
                <p className="text-critical basis-full text-[0.8rem]">{errors.k}</p>
              ) : null}
            </form>

            <p className="text-muted-foreground mt-3 text-[0.83rem]">
              A change takes effect at the next detection run. Flags already raised are
              not relabelled.
            </p>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
