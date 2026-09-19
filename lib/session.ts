import "server-only";

import { cookies } from "next/headers";

import { ROLES, accountByEmail, userFromAccount } from "@/lib/roles";
import type { RoleDefinition, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "sentinel_session";

export interface Session {
  user: SessionUser;
  role: RoleDefinition;
}

/**
 * The signed-in user for the current request.
 *
 * Better Auth owns real credentials and sessions (see `lib/auth.ts`); until a
 * database is attached, this cookie carries the account email and the account
 * is resolved from the reference dataset. Swapping this for
 * `auth.api.getSession()` is the only change the rest of the app needs.
 */
export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  const email = store.get(SESSION_COOKIE)?.value;
  if (!email) return null;

  const account = accountByEmail(email);
  if (!account || !account.active) return null;

  const user = userFromAccount(account);
  return { user, role: ROLES[user.role] };
}
