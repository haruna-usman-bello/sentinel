"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEACTIVATED_CODE, auth } from "@/lib/auth";
import { ROLES, isRole } from "@/lib/roles";
import { recordFailedSignIn, signInLockout } from "@/lib/sign-in-throttle";
import { fieldErrors, signInSchema } from "@/lib/validation";

export interface SignInState {
  errors?: Record<string, string>;
  values?: { email: string; password: string };
}

const DEACTIVATED_MESSAGE =
  "This account has been deactivated. Contact your state coordinator.";

/**
 * Signs in through Better Auth and lands on the role's home screen. Returns
 * the form state instead of redirecting when the credentials are refused.
 */
async function openSession(email: string, password: string): Promise<SignInState> {
  const requestHeaders = await headers();

  // Repeated wrong passwords pause sign-in for that address before Better Auth is asked.
  const lockout = await signInLockout(email);
  if (lockout.locked) {
    return {
      errors: {
        form: `Too many wrong passwords for this email address. Try again in ${lockout.minutesLeft} minute${lockout.minutesLeft === 1 ? "" : "s"}, or ask your state coordinator to reset your password.`,
      },
      values: { email, password: "" },
    };
  }

  let role: string;
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
    role = result.user.role;
  } catch (error) {
    if (error instanceof APIError) {
      const deactivated = error.body?.message === DEACTIVATED_CODE;
      if (!deactivated) {
        const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
        await recordFailedSignIn(email, forwarded);
      }
      return {
        errors: {
          form: deactivated
            ? DEACTIVATED_MESSAGE
            : "The email address or password is incorrect.",
        },
        values: { email, password: "" },
      };
    }
    throw error;
  }

  redirect(isRole(role) ? ROLES[role].home : "/");
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

  return openSession(parsed.data.email, parsed.data.password);
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

/**
 * The per-tier account picker on the sign-in screen. Development only: it
 * signs in with the seed password, which no deployed database has.
 */
export async function signInAsAccountAction(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await openSession(
    String(formData.get("email") ?? ""),
    process.env.SEED_PASSWORD ?? "password123",
  );
}
