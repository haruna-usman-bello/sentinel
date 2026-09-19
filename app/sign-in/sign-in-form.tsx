"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCOUNTS } from "@/lib/data";
import { DEMO_ACCOUNT_EMAILS, ROLES } from "@/lib/roles";
import {
  signInAction,
  signInAsAccountAction,
  type SignInState,
} from "@/lib/session-actions";

const DEMO_ACCOUNTS = DEMO_ACCOUNT_EMAILS.map(
  (email) => ACCOUNTS.find((a) => a.email === email)!,
);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-critical text-[0.8rem]">{message}</p>;
}

export function SignInForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, {});
  const errors = state.errors ?? {};

  return (
    <div className="grid items-start gap-[26px] lg:grid-cols-[minmax(300px,1fr)_minmax(300px,1.15fr)]">
      <form
        action={formAction}
        className="bg-card border-border flex flex-col gap-[15px] rounded-md border p-6 shadow-sm"
      >
        <h2 className="text-[1.15rem] font-semibold">Sign in</h2>

        {errors.form ? (
          <div className="border-critical/40 bg-critical-soft text-critical rounded-md border px-3 py-[9px] text-[0.83rem]">
            <strong className="font-semibold">Sign-in failed.</strong> {errors.form}
          </div>
        ) : null}

        <div className="flex flex-col gap-[5px]">
          <Label
            htmlFor="email"
            className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
          >
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.org"
            defaultValue={state.values?.email ?? ""}
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>

        <div className="flex flex-col gap-[5px]">
          <Label
            htmlFor="password"
            className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase"
          >
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
          <FieldError message={errors.password} />
        </div>

        <SubmitButton />
        <p className="text-muted-foreground m-0 text-[0.78rem]">
          Sessions expire after 30 minutes of inactivity.
        </p>
      </form>

      <div>
        <h3 className="mb-[9px] text-[0.95rem] font-semibold">Accounts on this system</h3>
        <p className="text-muted-foreground m-0 mb-[11px] text-[0.83rem]">
          Select an account to open its dashboard.
        </p>
        <div className="bg-border border-border flex flex-col gap-px overflow-hidden rounded-md border">
          {DEMO_ACCOUNTS.map((account) => (
            <form key={account.email} action={signInAsAccountAction}>
              <input type="hidden" name="email" value={account.email} />
              <button
                type="submit"
                className="bg-card hover:bg-accent grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-[14px] py-3 text-left transition-colors"
              >
                <span className="col-start-1 row-start-1 text-[0.88rem] font-semibold">
                  {account.name}
                </span>
                <span className="text-brand col-start-1 row-start-2 font-mono text-[0.7rem]">
                  {account.email}
                </span>
                <span className="text-faint col-start-2 row-span-2 row-start-1 self-center text-right font-mono text-[0.6rem] tracking-[0.09em] uppercase">
                  {ROLES[account.role].tier}
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
