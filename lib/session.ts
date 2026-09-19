import "server-only";

import { cookies } from "next/headers";

import { ROLES, isRole } from "@/lib/roles";
import type { Role, RoleDefinition } from "@/lib/types";

export const SESSION_COOKIE = "sentinel_role";

/**
 * The access tier for the current request.
 *
 * Better Auth owns real credentials and sessions (see `lib/auth.ts`); this
 * cookie carries only which tier's UI to render, so the UI can be driven
 * end to end before a database is attached.
 */
export async function currentRole(): Promise<RoleDefinition | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return isRole(value) ? ROLES[value as Role] : null;
}
