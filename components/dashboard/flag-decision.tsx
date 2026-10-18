"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transitionFlagAction } from "@/lib/actions/flags";
import { isConsequential, monthLabel, recipientsFor, usualPhrase } from "@/lib/domain";
import type { Flag, FlagStatus } from "@/lib/types";
import { fieldErrors, flagTransitionSchema } from "@/lib/validation";

const VERB: Partial<Record<FlagStatus, string>> = {
  confirmed: "Confirm an outbreak",
  false_alarm: "Dismiss as a false alarm",
  closed: "Close this flag",
};

const CONSEQUENCE: Partial<Record<FlagStatus, string>> = {
  confirmed: "This declares an outbreak. It goes into the audit trail under your name.",
  false_alarm:
    "This says the signal was not a real outbreak. The reason you give is what the decision is reviewed against later.",
  closed: "This ends it. A closed flag cannot be reopened; a new signal raises a new flag.",
};

/** What the dialog's button says it will do. */
const SUBMIT: Partial<Record<FlagStatus, string>> = {
  confirmed: "Confirm outbreak",
  false_alarm: "Dismiss as a false alarm",
  closed: "Close flag",
};

/** The transitions each status can reach, before the role's powers are applied. */
const RELEVANT: Record<FlagStatus, FlagStatus[]> = {
  pending: ["investigating", "confirmed", "false_alarm"],
  investigating: ["confirmed", "false_alarm"],
  confirmed: ["closed"],
  false_alarm: ["closed"],
  closed: [],
};

const LABELS: Record<FlagStatus, string> = {
  pending: "Reopen",
  investigating: "Investigate",
  confirmed: "Confirm",
  false_alarm: "False alarm",
  closed: "Close",
};

const LONG_LABELS: Record<FlagStatus, string> = {
  pending: "Reopen",
  investigating: "Start investigation",
  confirmed: "Confirm outbreak",
  false_alarm: "False alarm",
  closed: "Close flag",
};

function TransitionDialog({
  flag,
  to,
  pending,
  onConfirm,
  onOpenChange,
}: {
  flag: Flag;
  to: FlagStatus;
  pending: boolean;
  onConfirm: (note: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { role } = useDashboard();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const verb = VERB[to] ?? "Change status";
  const recipients = recipientsFor(flag, to, role);

  function submit() {
    const parsed = flagTransitionSchema.safeParse({ flagId: flag.id, to, note });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    onConfirm(parsed.data.note);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{verb}?</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm a status change on this flag.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[13px]">
          <p className="m-0 text-[0.88rem]">
            <strong className="font-semibold">
              {flag.facilityName} — {flag.disease}
            </strong>
            , {monthLabel(flag.period)} ·{" "}
            {flag.type === "statistical"
              ? [`${flag.cases} cases`, usualPhrase(flag)].filter(Boolean).join(", ")
              : "no report received"}
          </p>

          <div className="text-muted-foreground flex flex-col gap-[6px] text-[0.85rem]">
            <p className="m-0">
              {CONSEQUENCE[to]}
              {recipients.length
                ? recipients.length === 1
                  ? " This person is alerted:"
                  : " These people are alerted:"
                : ""}
            </p>
            {recipients.length ? (
              <ul className="text-foreground m-0 list-disc space-y-[2px] pl-5">
                {recipients.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-[5px]">
            <Label
              htmlFor="transition-note"
              className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
            >
              {to === "false_alarm" ? "Reason (required)" : "Note for the record (optional)"}
            </Label>
            <Input
              id="transition-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (errors.note) setErrors({});
              }}
              aria-invalid={!!errors.note}
              placeholder={
                to === "false_alarm"
                  ? "Why was this not a real signal?"
                  : "e.g. epi-linked to one ward; response team notified"
              }
            />
            {errors.note ? (
              <p className="text-critical text-[0.8rem]">{errors.note}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={to === "confirmed" ? "destructive" : "default"}
            disabled={pending}
            onClick={submit}
          >
            {pending ? "Saving…" : (SUBMIT[to] ?? verb)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders only the transitions this role may actually make. A control that
 * would be denied is not rendered as a disabled button — the officer's dashboard
 * simply has no "confirm" affordance.
 */
export function FlagDecision({
  flag,
  variant = "compact",
}: {
  flag: Flag;
  /**
   * `compact` keeps a dash so table columns stay aligned; `card` renders
   * nothing at all; `full` explains why no action is available.
   */
  variant?: "compact" | "card" | "full";
}) {
  const { role, raiseDenial, clearDenial } = useDashboard();
  const [confirming, setConfirming] = useState<FlagStatus | null>(null);
  const [pending, startTransition] = useTransition();

  function transition(to: FlagStatus, note: string) {
    startTransition(async () => {
      const result = await transitionFlagAction({ flagId: flag.id, to, note });
      if (result.ok) {
        setConfirming(null);
        clearDenial();
        toast.success(result.message, { description: result.description });
      } else {
        setConfirming(null);
        if (result.denial) raiseDenial(result.denial);
        toast.error(result.error);
      }
    });
  }

  const allowed = role.can[flag.status] ?? [];
  const options = RELEVANT[flag.status].filter((to) => allowed.includes(to));

  if (!options.length) {
    if (variant === "card") return null;
    if (variant === "compact") {
      return <span className="text-muted-foreground text-[0.83rem]">—</span>;
    }
    return (
      <p className="text-muted-foreground text-[0.83rem]">
        {RELEVANT[flag.status].length
          ? "No action is available to your role for this flag."
          : "This flag is closed. No further transition is defined."}
      </p>
    );
  }

  function choose(to: FlagStatus) {
    if (isConsequential(to)) {
      setConfirming(to);
      return;
    }
    transition(to, "");
  }

  return (
    <>
      <div
        className={
          variant === "compact"
            ? "flex items-center gap-[7px] whitespace-nowrap"
            : "flex flex-wrap items-center gap-[7px]"
        }
      >
        {options.map((to) => (
          <Button
            key={to}
            size={variant === "full" ? "default" : "sm"}
            variant={
              to === "confirmed"
                ? "destructive"
                : to === "investigating"
                  ? "default"
                  : "outline"
            }
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              choose(to);
            }}
          >
            {variant === "full" ? LONG_LABELS[to] : LABELS[to]}
          </Button>
        ))}
      </div>
      {confirming ? (
        <TransitionDialog
          flag={flag}
          to={confirming}
          pending={pending}
          onConfirm={(note) => transition(confirming, note)}
          onOpenChange={(open) => !open && !pending && setConfirming(null)}
        />
      ) : null}
    </>
  );
}
