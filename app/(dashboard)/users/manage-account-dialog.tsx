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
import { ROLES } from "@/lib/roles";
import {
  resetAccountPasswordAction,
  toggleAccountAction,
  updateAccountAction,
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
  const [name, setName] = useState(account.name);
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
    const parsed = updateAccountSchema.safeParse({ accountId: account.id, name, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    run(() => updateAccountAction(parsed.data));
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
              { term: "Role", value: ROLES[account.role].label },
              {
                term: "Posted to",
                value:
                  account.lga !== "—"
                    ? `${account.lga} LGA, ${account.state}`
                    : account.state === "—"
                      ? "Nationwide"
                      : `${account.state} State`,
              },
              {
                term: "Email",
                value: <span className="break-all">{account.email}</span>,
              },
              {
                term: "Status",
                value: account.active
                  ? "Active"
                  : `Deactivated${account.note ? `, ${account.note.replace(/^Deactivated /, "")}` : ""}`,
              },
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-name" className="text-[0.88rem] font-medium">
              Name
            </Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({});
              }}
              aria-invalid={!!errors.name}
            />
            {errors.name ? (
              <p className="text-critical text-[0.84rem]">{errors.name}</p>
            ) : (
              <p className="text-muted-foreground text-[0.84rem]">
                Past decisions and log entries keep the name used at the time.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="account-phone"
              className="text-[0.88rem] font-medium"
            >
              Phone (optional)
            </Label>
            <Input
              id="account-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors({});
              }}
              aria-invalid={!!errors.phone}
              placeholder="+234…"
            />
            {errors.phone ? (
              <p className="text-critical text-[0.84rem]">{errors.phone}</p>
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
