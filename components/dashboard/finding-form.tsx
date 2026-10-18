"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addFindingAction } from "@/lib/actions/flags";
import { fieldErrors, findingSchema } from "@/lib/validation";

/** The officer's box for what an investigation turned up. Each finding goes into the audit trail. */
export function FindingForm({ flagId, autoFocus = false }: { flagId: string; autoFocus?: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = findingSchema.safeParse({ flagId, note });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).note ?? "Check the finding.");
      return;
    }
    startTransition(async () => {
      const result = await addFindingAction(parsed.data);
      if (result.ok) {
        setNote("");
        setError(null);
        toast.success(result.message);
      } else if (result.fieldErrors?.note) {
        setError(result.fieldErrors.note);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[7px]">
      <Label
        htmlFor="finding"
        className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
      >
        What did you find?
      </Label>
      <Textarea
        id="finding"
        rows={3}
        value={note}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        placeholder="e.g. Visited the facility; the line list matches the register."
        onChange={(e) => {
          setNote(e.target.value);
          if (error) setError(null);
        }}
      />
      {error ? <p className="text-critical text-[0.8rem]">{error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add finding"}
        </Button>
      </div>
    </form>
  );
}
