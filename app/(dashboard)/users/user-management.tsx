"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { createAccountAction } from "@/lib/actions/accounts";
import { paginate } from "@/lib/domain";
import type { PostingOptions } from "@/lib/queries/accounts";
import type { AccountRecord } from "@/lib/types";
import { createAccountSchema, fieldErrors } from "@/lib/validation";

import { ManageAccountDialog } from "./manage-account-dialog";

export interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

/**
 * A temporary password is shown exactly once, here, for the administrator to
 * pass on. It is not stored in clear and cannot be shown again — the next
 * step is another reset.
 */
function IssuedPasswordNotice({
  issued,
  onDismiss,
}: {
  issued: IssuedPassword;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="bg-warning-soft border-warning/40 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border px-[15px] py-[13px] text-[0.85rem]"
    >
      <div>
        <strong className="font-semibold">Temporary password for {issued.name}</strong>
        <div className="mt-1">
          <span className="font-mono text-[0.78rem]">{issued.email}</span> ·{" "}
          <code className="bg-card rounded-sm px-[6px] py-[2px] font-mono text-[0.85rem] tracking-wide select-all">
            {issued.password}
          </code>
        </div>
        <div className="text-muted-foreground mt-1 text-[0.78rem]">
          Shown once. Pass it on securely; they should change it from their account screen.
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

function CreateAccountForm({
  isSysadmin,
  postings,
  onCreated,
}: {
  isSysadmin: boolean;
  postings: PostingOptions;
  onCreated: (issued: IssuedPassword) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState("officer");
  const [state, setState] = useState(postings.states[0] ?? "");
  const [lga, setLga] = useState(postings.lgasByState[postings.states[0] ?? ""]?.[0] ?? "");
  const [pending, startTransition] = useTransition();

  const roles = isSysadmin
    ? ["officer", "supervisor", "state", "national"]
    : ["officer", "supervisor"];
  const lgas = postings.lgasByState[state] ?? [];
  const needsLga = role === "officer" || role === "supervisor";
  const needsState = role !== "national";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = createAccountSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      role,
      state: needsState ? state : "—",
      lga: needsLga ? lga : "—",
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createAccountAction(parsed.data);
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        if (result.temporaryPassword) {
          onCreated({ name: parsed.data.name, email: parsed.data.email, password: result.temporaryPassword });
        }
        form.reset();
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
    });
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
        <Select
          value={state}
          onValueChange={(s) => {
            setState(s);
            setLga(postings.lgasByState[s]?.[0] ?? "");
          }}
          disabled={!needsState}
        >
          <SelectTrigger id="new-state" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {postings.states.map((s) => (
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
        <Select value={lga} onValueChange={setLga} disabled={!needsLga}>
          <SelectTrigger id="new-lga" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lgas.map((l) => (
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

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>

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

export function UserManagement({
  accounts,
  postings,
}: {
  accounts: AccountRecord[];
  postings: PostingOptions;
}) {
  const { role } = useDashboard();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const isSysadmin = role.key === "sysadmin";
  const q = query.trim().toLowerCase();

  const rows = accounts.filter(
    (a) =>
      !q || [a.name, a.role, a.state, a.lga, a.email].join(" ").toLowerCase().includes(q),
  );
  const managed = managing ? accounts.find((a) => a.id === managing) : null;

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
            <CreateAccountForm isSysadmin={isSysadmin} postings={postings} onCreated={setIssued} />
            {issued ? <IssuedPasswordNotice issued={issued} onDismiss={() => setIssued(null)} /> : null}
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
                          onClick={() => setManaging(account.id)}
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

      {managed ? (
        <ManageAccountDialog
          account={managed}
          onClose={() => setManaging(null)}
          onPasswordIssued={setIssued}
        />
      ) : null}
    </>
  );
}
