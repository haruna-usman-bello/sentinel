"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { KeyValue } from "@/components/dashboard/panel";
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
import {
  resetAccountPasswordAction,
  toggleAccountAction,
  updateAccountPhoneAction,
} from "@/lib/actions/accounts";
import type { ActionResult } from "@/lib/actions/shared";
import type { AccountRecord } from "@/lib/types";
import { fieldErrors, updateAccountSchema } from "@/lib/validation";

import type { IssuedPassword } from "./user-management";

export function ManageAccountDialog({
  account,
  onClose,
  onPasswordIssued,
}: {
  account: AccountRecord;
  onClose: () => void;
  onPasswordIssued: (issued: IssuedPassword) => void;
}) {
  const [phone, setPhone] = useState(account.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  /** Runs an action, toasts its outcome and closes on success. */
  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        onClose();
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
    });
  }

  function save() {
    const parsed = updateAccountSchema.safeParse({ accountId: account.id, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    run(() => updateAccountPhoneAction(parsed.data));
  }

  function resetPassword() {
    run(async () => {
      const result = await resetAccountPasswordAction(account.id);
      if (result.ok && result.temporaryPassword) {
        onPasswordIssued({ name: account.name, email: account.email, password: result.temporaryPassword });
      }
      return result;
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{account.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Manage this surveillance account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[13px]">
          <KeyValue
            items={[
              { term: "Role", value: account.role },
              {
                term: "Scope",
                value:
                  account.lga !== "—"
                    ? `${account.state} · ${account.lga} LGA`
                    : account.state,
              },
              {
                term: "Email",
                value: (
                  <span className="font-mono text-[0.78rem] break-all">
                    {account.email}
                  </span>
                ),
              },
              {
                term: "Status",
                value: account.active
                  ? "Active"
                  : `Deactivated${account.note ? ` — ${account.note.replace(/^Deactivated /, "")}` : ""}`,
              },
            ]}
          />

          <div className="flex flex-col gap-[5px]">
            <Label
              htmlFor="account-phone"
              className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
            >
              Phone (sets the alert channel)
            </Label>
            <Input
              id="account-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors({});
              }}
              aria-invalid={!!errors.phone}
              placeholder="+234… — leave blank for email alerts"
            />
            {errors.phone ? (
              <p className="text-critical text-[0.8rem]">{errors.phone}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={pending} onClick={resetPassword}>
            Reset password
          </Button>
          <Button
            variant={account.active ? "destructive" : "outline"}
            disabled={pending}
            onClick={() => run(() => toggleAccountAction(account.id))}
          >
            {account.active ? "Deactivate" : "Reactivate"}
          </Button>
          <Button disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
