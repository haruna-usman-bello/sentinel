"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ROLES, roleByEmail } from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session";
import { fieldErrors, signInSchema } from "@/lib/validation";

export interface SignInState {
  errors?: Record<string, string>;
  values?: { email: string; password: string };
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

  const role = roleByEmail(parsed.data.email);
  if (!role) {
    return {
      errors: {
        email:
          "No account matches that email address. Check the spelling, or pick one of the accounts listed.",
      },
      values,
    };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, role.key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  redirect(role.home);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

/** Used by the account picker on the sign-in screen. */
export async function signInAsRoleAction(formData: FormData): Promise<void> {
  const key = String(formData.get("role") ?? "");
  if (!(key in ROLES)) return;
  const role = ROLES[key as keyof typeof ROLES];

  const store = await cookies();
  store.set(SESSION_COOKIE, role.key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  redirect(role.home);
}
