"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";
import {
  signInAction,
  signInAsAccountAction,
  type SignInState,
} from "@/lib/session-actions";

/** One account per tier, for the development-only picker. */
export interface DemoAccount {
  name: string;
  email: string;
  role: Role;
}

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

export function SignInForm({ demoAccounts }: { demoAccounts: DemoAccount[] | null }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, {});
  const errors = state.errors ?? {};

  return (
    <div className="flex flex-col gap-7">
      <form
        action={formAction}
        className="bg-card border-border flex flex-col gap-4 rounded-xl border p-6 shadow-xs"
      >
        <h2 className="text-[1.15rem] font-semibold">Sign in</h2>

        {errors.form ? (
          <div role="alert" className="bg-critical-soft rounded-lg px-3 py-2.5 text-[0.88rem]">
            <strong className="text-critical font-semibold">Sign-in failed.</strong> {errors.form}
          </div>
        ) : null}

        <div className="flex flex-col gap-[5px]">
          <Label
            htmlFor="email"
            className="text-[0.88rem] font-medium"
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
            className="text-[0.88rem] font-medium"
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
        <p className="text-muted-foreground m-0 text-[0.84rem]">
          You are signed out after 30 minutes without activity.
        </p>
      </form>

      {demoAccounts ? (
        <div>
          <h3 className="mb-1 text-[0.95rem] font-semibold">Accounts on this system</h3>
          <p className="text-muted-foreground m-0 mb-3 text-[0.86rem]">
            Shown in development only. Pick one to open its dashboard.
          </p>
          <div className="bg-border border-border flex flex-col gap-px overflow-hidden rounded-xl border">
            {demoAccounts.map((account) => (
              <form key={account.email} action={signInAsAccountAction}>
                <input type="hidden" name="email" value={account.email} />
                <button
                  type="submit"
                  className="bg-card hover:bg-accent grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-[14px] py-3 text-left transition-colors"
                >
                  <span className="col-start-1 row-start-1 text-[0.88rem] font-semibold">
                    {account.name}
                  </span>
                  <span className="text-muted-foreground col-start-1 row-start-2 text-[0.82rem]">
                    {ROLES[account.role].label}
                  </span>
                  <span className="text-faint col-start-2 row-span-2 row-start-1 self-center text-right text-[0.8rem]">
                    {ROLES[account.role].tier}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
