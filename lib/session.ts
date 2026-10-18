import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { ROLES, isRole } from "@/lib/roles";
import type { RoleDefinition, SessionUser } from "@/lib/types";

export interface Session {
  user: SessionUser;
  role: RoleDefinition;
  /** When this session was opened. */
  signedInAt: Date;
}

/**
 * The signed-in user for the current request, resolved once per request and
 * shared by every layout, page and action that asks.
 *
 * Better Auth reads the user row on every call, so an account deactivated a
 * moment ago is refused on its very next request — there is no cached copy of
 * `active` to wait out.
 */
export const currentSession = cache(async (): Promise<Session | null> => {
  // The cookie comes from `cookies()`, not the raw request header. A password
  // change replaces the session, and Next then re-renders the page within that
  // same request: only `cookies()` holds the new token by then, and reading the
  // old one bounced the user through /sign-in.
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;

  const { user } = result;
  if (!user.active || !isRole(user.role)) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.stateName ?? undefined,
      lga: user.lgaName ?? undefined,
      phone: user.phone ?? undefined,
    },
    role: ROLES[user.role],
    signedInAt: result.session.createdAt,
  };
});

/**
 * The session, or the sign-in screen. A page renders concurrently with its
 * layout, so it can reach here with no session in the moment before the
 * layout's own redirect lands; sending it the same way keeps that quiet.
 */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  return session;
}
