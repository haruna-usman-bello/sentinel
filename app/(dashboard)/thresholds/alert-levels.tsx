"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Status } from "@/components/dashboard/badges";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAlertLevelAction } from "@/lib/actions/system";
import { stampLabel } from "@/lib/domain";
import type { DiseaseThreshold } from "@/lib/types";
import { alertLevelSchema, fieldErrors } from "@/lib/validation";

/** Levels are shown to two places, as the detector tests them, so 2.00 sits beside 1.25. */
const level = (k: number) => `${k.toFixed(2)}×`;

function LevelEditor({
  threshold,
  recommended,
  onDone,
}: {
  threshold: DiseaseThreshold;
  recommended: number | null;
  onDone: () => void;
}) {
  const [k, setK] = useState(threshold.k.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = alertLevelSchema.safeParse({ disease: threshold.disease, k });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).k ?? "Check the alert level.");
      return;
    }
    startTransition(async () => {
      const result = await setAlertLevelAction(parsed.data);
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        onDone();
      } else {
        setError(result.fieldErrors?.k ?? result.error);
      }
    });
  }

  const id = `level-${threshold.disease}`;
  return (
    <form onSubmit={submit} className="bg-secondary/60 mt-3 flex flex-col gap-3 rounded-lg p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id} className="text-[0.88rem] font-medium">
            New alert level for {threshold.disease}
          </Label>
          <Input
            id={id}
            value={k}
            autoFocus
            inputMode="decimal"
            aria-invalid={!!error}
            onChange={(e) => {
              setK(e.target.value);
              if (error) setError(null);
            }}
            className="bg-card w-28"
          />
        </div>
        {recommended !== null && Number(k) !== recommended ? (
          <Button type="button" variant="ghost" onClick={() => setK(recommended.toFixed(2))}>
            Use the recommended {level(recommended)}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-critical text-[0.84rem]">{error}</p> : null}
      <p className="text-muted-foreground text-[0.86rem]">
        Lower catches more outbreaks and raises more flags. The change applies from the next
        detection run; flags already raised keep their label.
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save alert level"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AlertLevels({
  thresholds,
  raised,
  recommended,
}: {
  thresholds: DiseaseThreshold[];
  raised: Record<string, number>;
  /** The level the detector evaluation recommends; null until it has been run. */
  recommended: number | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Alert levels" />
      <PageBody>
        <Lead>
          <strong>How far a month must rise above a facility&apos;s usual level before Sentinel flags it.</strong>{" "}
          The level counts in steps of the facility&apos;s usual month-to-month variation, so a lower
          level catches more outbreaks and raises more flags.
        </Lead>

        <ul className="m-0 list-none border-t p-0">
          {thresholds.map((t) => {
            const differs = recommended !== null && Math.abs(t.k - recommended) > 0.001;
            return (
              <li key={t.disease} className="border-line-soft border-b px-1 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline gap-3">
                      <span className="text-[1rem] font-semibold">{t.disease}</span>
                      <span className="text-[1.25rem] font-bold tracking-[-0.01em]">{level(t.k)}</span>
                    </span>
                    <span className="text-muted-foreground text-[0.86rem]">
                      Set by {t.setBy} on {stampLabel(t.setAt)}. {raised[t.disease] ?? 0} rises flagged so far.
                    </span>
                    {recommended !== null ? (
                      differs ? (
                        <Status tone="warning">Testing recommends {level(recommended)}</Status>
                      ) : (
                        <Status tone="success">Matches the tested recommendation</Status>
                      )
                    ) : null}
                  </div>
                  {editing !== t.disease ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing(t.disease)}>
                      Change
                    </Button>
                  ) : null}
                </div>
                {editing === t.disease ? (
                  <LevelEditor threshold={t} recommended={recommended} onDone={() => setEditing(null)} />
                ) : null}
              </li>
            );
          })}
        </ul>

        {recommended !== null ? (
          <p className="text-muted-foreground text-[0.88rem]">
            The recommendation comes from{" "}
            <Link href="/detector" className="text-brand font-medium hover:underline hover:underline-offset-[3px]">
              detector accuracy
            </Link>
            , which tests every level against outbreaks of known size.
          </p>
        ) : null}
      </PageBody>
    </>
  );
}
