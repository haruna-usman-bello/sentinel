"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Status } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DataPager, SearchInput } from "@/components/dashboard/data-pager";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createAccountAction } from "@/lib/actions/accounts";
import { paginate } from "@/lib/domain";
import type { PostingOptions } from "@/lib/queries/accounts";
import { ROLES } from "@/lib/roles";
import type { AccountRecord, Role } from "@/lib/types";
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
      className="bg-warning-soft flex flex-wrap items-start justify-between gap-3 rounded-lg px-4 py-3 text-[0.9rem]"
    >
      <div className="min-w-0">
        <strong className="font-semibold">Temporary password for {issued.name}</strong>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground break-all">{issued.email}</span>
          <code className="bg-card rounded-md px-2 py-0.5 font-mono text-[0.9rem] select-all">
            {issued.password}
          </code>
        </div>
        <div className="text-muted-foreground mt-1 text-[0.84rem]">
          Shown once. Pass it on securely; they should change it from My account.
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

/** Where a new account's alerts will go, given what this system has set up. */
function alertNote(channels: { sms: boolean; email: boolean }): string {
  if (channels.sms && channels.email) return "Alerts go by SMS when there is a phone number, and by email otherwise.";
  if (channels.email) return "Alerts go by email. A phone number is kept for contact.";
  if (channels.sms) return "Alerts go by SMS, so add a phone number.";
  return "No alert channel is set up yet, so alerts are not sent.";
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
  // Open on a state that has an LGA to post to, since the form starts on an officer.
  const firstState =
    postings.states.find((s) => postings.lgasByState[s]?.length) ?? postings.states[0] ?? "";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<Role>("officer");
  const [state, setState] = useState(firstState);
  const [lga, setLga] = useState(postings.lgasByState[firstState]?.[0] ?? "");
  const [pending, startTransition] = useTransition();

  const roles: Role[] = isSysadmin
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

  const labelClass = "text-[0.88rem] font-medium";
  const fieldError = (field: string) =>
    errors[field] ? <p className="text-critical text-[0.82rem]">{errors[field]}</p> : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-name" className={labelClass}>
          Name
        </Label>
        <Input id="new-name" name="name" placeholder="e.g. Ikara LGA Officer" aria-invalid={!!errors.name} />
        {fieldError("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-email" className={labelClass}>
          Email
        </Label>
        <Input
          id="new-email"
          name="email"
          type="email"
          placeholder="officer.ikara@example.org"
          aria-invalid={!!errors.email}
        />
        {fieldError("email")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-role" className={labelClass}>
          Role
        </Label>
        <Select value={role} onValueChange={(r) => setRole(r as Role)}>
          <SelectTrigger id="new-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLES[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsState ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="new-state" className={labelClass}>
              State
            </Label>
            <Select
              value={state}
              onValueChange={(s) => {
                setState(s);
                setLga(postings.lgasByState[s]?.[0] ?? "");
              }}
            >
              <SelectTrigger id="new-state" className="w-full">
                <SelectValue placeholder="Pick a state" />
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

          {needsLga ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-lga" className={labelClass}>
                LGA
              </Label>
              <Select value={lga} onValueChange={setLga} disabled={!lgas.length}>
                <SelectTrigger id="new-lga" className="w-full">
                  <SelectValue placeholder={lgas.length ? "Pick an LGA" : "None yet"} />
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
          ) : null}
        </div>
      ) : null}

      {needsLga && state && !lgas.length ? (
        <p className="text-muted-foreground text-[0.85rem]">
          No facility in {state} is on the register yet, so there is no LGA to post an officer or supervisor to.
          {isSysadmin ? " Read the register on the DHIS2 connection screen first." : ""}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-phone" className={labelClass}>
          Phone (optional)
        </Label>
        <Input id="new-phone" name="phone" placeholder="+234…" aria-invalid={!!errors.phone} />
        {fieldError("phone")}
      </div>

      {errors.state || errors.lga || errors.role ? (
        <p className="text-critical text-[0.82rem]">{errors.state ?? errors.lga ?? errors.role}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

function postedTo(account: AccountRecord): string {
  if (account.lga !== "—") return `${account.lga} LGA, ${account.state}`;
  if (account.state !== "—") return `${account.state} State`;
  return "Nationwide";
}

export function UserManagement({
  accounts,
  postings,
  channels,
}: {
  accounts: AccountRecord[];
  postings: PostingOptions;
  channels: { sms: boolean; email: boolean };
}) {
  const { role } = useDashboard();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const isSysadmin = role.key === "sysadmin";
  const q = query.trim().toLowerCase();

  const rows = accounts.filter(
    (a) =>
      !q ||
      [a.name, ROLES[a.role].label, a.state, a.lga, a.email].join(" ").toLowerCase().includes(q),
  );
  const managed = managing ? accounts.find((a) => a.id === managing) : null;
  const inactive = accounts.filter((a) => !a.active).length;

  const pageData = paginate(rows, page);

  return (
    <>
      <PageHeader
        title="Accounts"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add account
          </Button>
        }
      />
      <PageBody>
        <DenialNotice />

        {issued ? <IssuedPasswordNotice issued={issued} onDismiss={() => setIssued(null)} /> : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              label="Search accounts"
              placeholder="Search name, role, place or email"
              className="min-w-0 flex-1 basis-56 sm:max-w-80"
            />
            <span className="text-muted-foreground ml-auto text-[0.86rem]">
              {q ? `${rows.length} of ${accounts.length}` : accounts.length}{" "}
              {accounts.length === 1 ? "account" : "accounts"}
              {inactive && !q ? `, ${inactive} deactivated` : ""}
            </span>
          </div>

          <div>
            {pageData.rows.length ? (
              <ul className="@container m-0 list-none border-t p-0">
                {pageData.rows.map((account) => (
                  <li
                    key={account.id}
                    className="border-line-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b px-1 py-3 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_7rem_auto]"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={account.active ? "text-[0.93rem] font-semibold" : "text-muted-foreground text-[0.93rem] font-semibold"}>
                        {account.name}
                      </span>
                      <span className="text-muted-foreground text-[0.84rem]">
                        {ROLES[account.role].label}, {postedTo(account)}
                      </span>
                    </span>
                    <span className="text-muted-foreground col-start-1 row-start-2 flex min-w-0 flex-col text-[0.84rem] @2xl:col-start-2 @2xl:row-start-1">
                      <span className="truncate">{account.email}</span>
                      {account.phone ? <span>{account.phone}</span> : null}
                    </span>
                    <span className="col-start-1 row-start-3 @2xl:col-start-3 @2xl:row-start-1">
                      {account.active ? (
                        <Status tone="success">Active</Status>
                      ) : (
                        <Status tone="neutral">Deactivated</Status>
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="col-start-2 row-span-3 row-start-1 @2xl:col-start-4 @2xl:row-span-1"
                      onClick={() => setManaging(account.id)}
                    >
                      Manage
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground border-t py-3 text-[0.9rem]">
                {accounts.length ? `No account matches “${query}”.` : "No account has been added yet."}
              </p>
            )}
            <DataPager page={pageData} onPageChange={setPage} />
          </div>

          <p className="text-muted-foreground text-[0.86rem]">
            Deactivating an account keeps its history in the audit trail. Accounts are never deleted.
          </p>
        </div>
      </PageBody>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add an account</SheetTitle>
            <SheetDescription>
              {alertNote(channels)} They get a temporary password to change when they first sign in.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CreateAccountForm
              isSysadmin={isSysadmin}
              postings={postings}
              onCreated={(next) => {
                setIssued(next);
                setAdding(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

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
