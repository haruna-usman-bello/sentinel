"use client";

import { useState } from "react";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
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
import type { AccountRecord } from "@/lib/types";
import { fieldErrors, updateAccountSchema } from "@/lib/validation";

export function ManageAccountDialog({
  account,
  onClose,
}: {
  account: AccountRecord;
  onClose: () => void;
}) {
  const { updateAccountPhone, toggleAccount, resetAccountPassword } = useDashboard();
  const [phone, setPhone] = useState(account.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function save() {
    const parsed = updateAccountSchema.safeParse({ accountId: account.id, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    updateAccountPhone(account.id, parsed.data.phone);
    onClose();
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetAccountPassword(account.id);
              onClose();
            }}
          >
            Reset password
          </Button>
          <Button
            variant={account.active ? "destructive" : "outline"}
            onClick={() => {
              toggleAccount(account.id);
              onClose();
            }}
          >
            {account.active ? "Deactivate" : "Reactivate"}
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
