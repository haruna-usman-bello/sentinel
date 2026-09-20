"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusPill } from "@/components/dashboard/badges";
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
import { isConsequential, recipientsFor } from "@/lib/domain";
import type { Flag, FlagStatus } from "@/lib/types";
import { fieldErrors, flagTransitionSchema } from "@/lib/validation";

const VERB: Partial<Record<FlagStatus, string>> = {
  confirmed: "Confirm an outbreak",
  false_alarm: "Dismiss as a false alarm",
  closed: "Close this flag",
};

const CONSEQUENCE: Partial<Record<FlagStatus, string>> = {
  confirmed:
    "This declares an outbreak. It is recorded against your name in the audit trail and escalated immediately.",
  false_alarm:
    "This states that the signal was not a real outbreak. The reason you give is what the decision is reviewed against later.",
  closed:
    "This ends the investigation. A closed flag cannot be reopened — a new signal raises a new flag.",
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
            , {flag.period} · {flag.lga} LGA, {flag.state} State{" "}
            {flag.type === "statistical" ? (
              <>
                · <span className="font-mono">z {flag.z?.toFixed(2)}</span> against k ={" "}
                {flag.k?.toFixed(1)}
              </>
            ) : (
              "· no report received"
            )}
          </p>

          <p className="text-muted-foreground m-0 text-[0.83rem]">{CONSEQUENCE[to]}</p>

          <div className="bg-secondary border-line-soft flex flex-col gap-[7px] rounded-md border px-[14px] py-3 text-[0.83rem]">
            <span className="text-faint font-mono text-[0.66rem] tracking-[0.11em] uppercase">
              What happens when you {to === "closed" ? "close" : "confirm"}
            </span>
            <ul className="m-0 list-disc space-y-1 pl-4">
              <li>
                Status moves <StatusPill status={flag.status} /> →{" "}
                <StatusPill status={to} />
              </li>
              <li>An entry is appended to the audit trail under your name</li>
              {to !== "closed" ? (
                <li>
                  {recipients.length ? "Alerts dispatch to:" : "No onward escalation is defined for this transition."}
                  {recipients.length ? <br /> : null}
                  {recipients.map((r) => (
                    <span key={r} className="block font-mono text-[0.74rem]">
                      {r}
                    </span>
                  ))}
                </li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-col gap-[5px]">
            <Label
              htmlFor="transition-note"
              className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
            >
              Note for the record{to === "false_alarm" ? " (required)" : " (optional)"}
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
            {pending ? "Saving…" : verb}
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
