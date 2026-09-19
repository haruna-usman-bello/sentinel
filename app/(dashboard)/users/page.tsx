"use client";

import { useState } from "react";

import { StatusPill, Tag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Panel,
  PanelBody,
  PanelFootnote,
  PanelHeader,
} from "@/components/dashboard/panel";
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
import { paginate } from "@/lib/domain";
import type { AccountRecord } from "@/lib/types";
import { createAccountSchema, fieldErrors } from "@/lib/validation";

import { ManageAccountDialog } from "./manage-account-dialog";

const LGAS = ["Zaria", "Sabon Gari", "Giwa", "Kudan", "Ikara"];

export default function UsersPage() {
  return (
    <RoleGate allow={["sysadmin", "state"]}>
      <UserManagement />
    </RoleGate>
  );
}

function CreateAccountForm({ isSysadmin }: { isSysadmin: boolean }) {
  const { createAccount } = useDashboard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState("officer");
  const [state, setState] = useState(isSysadmin ? "Kaduna" : "Kaduna");
  const [lga, setLga] = useState("Zaria");

  const roles = isSysadmin
    ? ["officer", "supervisor", "state", "national"]
    : ["officer", "supervisor"];
  const states = isSysadmin ? ["Kaduna", "Edo", "Borno", "Sokoto", "Kano"] : ["Kaduna"];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createAccountSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      role,
      state,
      lga,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    createAccount(parsed.data);
    event.currentTarget.reset();
  }

  const labelClass =
    "text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase";

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-[9px]">
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-name" className={labelClass}>
          Name
        </Label>
        <Input
          id="new-name"
          name="name"
          placeholder="e.g. Ikara LGA Officer"
          aria-invalid={!!errors.name}
          className="w-52"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-email" className={labelClass}>
          Email
        </Label>
        <Input
          id="new-email"
          name="email"
          type="email"
          placeholder="officer.ikara@example.org"
          aria-invalid={!!errors.email}
          className="w-56"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-role" className={labelClass}>
          Role
        </Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="new-role" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-state" className={labelClass}>
          State
        </Label>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger id="new-state" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-lga" className={labelClass}>
          LGA
        </Label>
        <Select value={lga} onValueChange={setLga}>
          <SelectTrigger id="new-lga" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LGAS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="new-phone" className={labelClass}>
          Phone (optional)
        </Label>
        <Input
          id="new-phone"
          name="phone"
          placeholder="+234…"
          aria-invalid={!!errors.phone}
          className="w-44"
        />
      </div>

      <Button type="submit">Create account</Button>

      {Object.keys(errors).length ? (
        <ul className="text-critical basis-full space-y-1 text-[0.8rem]">
          {Object.entries(errors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function UserManagement() {
  const { accounts, role, scope } = useDashboard();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<AccountRecord | null>(null);

  const isSysadmin = role.key === "sysadmin";
  const q = query.trim().toLowerCase();

  const rows = accounts.filter(
    (a) =>
      (isSysadmin || a.state === scope.state) &&
      (!q ||
        [a.name, a.role, a.state, a.lga, a.email].join(" ").toLowerCase().includes(q)),
  );

  const pageData = paginate(rows, page);

  return (
    <>
      <PageHeader title="User management" />
      <PageBody>

        <DenialNotice />

        <Panel>
          <PanelHeader
            title="Create an account"
            description="An account with a phone number is alerted by SMS; otherwise by email."
          />
          <PanelBody>
            <CreateAccountForm isSysadmin={isSysadmin} />
          </PanelBody>

          <PanelHeader
            className="border-t"
            actions={
              <span className="text-muted-foreground font-mono text-[0.78rem]">
                {rows.length} account{rows.length === 1 ? "" : "s"}
              </span>
            }
          >
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              label="Search accounts"
              placeholder="Search name, role, state, LGA, email…"
            />
          </PanelHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground text-[0.83rem]"
                    >
                      No account matches “{query}”.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.rows.map((account) => (
                    <TableRow
                      key={account.id}
                      className={account.active ? undefined : "opacity-60"}
                    >
                      <TableCell>
                        <strong className="font-semibold">{account.name}</strong>
                        {account.note ? (
                          <div className="text-muted-foreground mt-[2px] text-[0.72rem]">
                            {account.note}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Tag>{account.role}</Tag>
                      </TableCell>
                      <TableCell>{account.state}</TableCell>
                      <TableCell>{account.lga}</TableCell>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {account.phone || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[0.76rem]">
                        {account.email}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={account.active ? "closed" : "false_alarm"}
                          label={account.active ? "active" : "disabled"}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setManaging(account)}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPager page={pageData} onPageChange={setPage} />

          <PanelFootnote>
            Deactivating an account keeps its history in the audit trail. Accounts are
            never deleted.
          </PanelFootnote>
        </Panel>
      </PageBody>

      {managing ? (
        <ManageAccountDialog
          account={accounts.find((a) => a.id === managing.id) ?? managing}
          onClose={() => setManaging(null)}
        />
      ) : null}
    </>
  );
}
