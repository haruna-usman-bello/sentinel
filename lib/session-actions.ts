"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ROLES, accountByEmail } from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session";
import type { AccountRecord } from "@/lib/types";
import { fieldErrors, signInSchema } from "@/lib/validation";

export interface SignInState {
  errors?: Record<string, string>;
  values?: { email: string; password: string };
}

async function openSession(account: AccountRecord): Promise<never> {
  const store = await cookies();
  store.set(SESSION_COOKIE, account.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  redirect(ROLES[account.role].home);
}

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const values = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values };
  }

  const account = accountByEmail(parsed.data.email);
  if (!account) {
    return {
      errors: {
        email:
          "No account matches that email address. Check the spelling, or pick one of the accounts listed.",
      },
      values,
    };
  }
  if (!account.active) {
    return {
      errors: {
        form: "This account has been deactivated. Contact your state coordinator.",
      },
      values,
    };
  }

  return openSession(account);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

/** Used by the account picker on the sign-in screen. */
export async function signInAsAccountAction(formData: FormData): Promise<void> {
  const account = accountByEmail(String(formData.get("email") ?? ""));
  if (!account || !account.active) return;
  await openSession(account);
}
