import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { formatStamp } from "@/lib/domain";
import { scopeOf } from "@/lib/roles";
import { requireSession, type Session } from "@/lib/session";
import type { Scope } from "@/lib/types";

/**
 * The data access layer. Every function here runs on the server, takes the
 * caller's scope explicitly, and returns the plain objects the screens render —
 * never a Prisma row. Scope is applied inside the query, so a screen outside a
 * role's tier is empty rather than filtered after the fact.
 */

export interface Viewer extends Session {
  scope: Scope;
}

/** The signed-in user together with the scope their posting gives them. */
export async function viewer(): Promise<Viewer> {
  const session = await requireSession();
  return { ...session, scope: scopeOf(session.user) };
}

/** Prisma `where` for rows that hang off a facility, or null for a scope that sees nothing. */
export function facilityScope(scope: Scope): Prisma.FacilityWhereInput | null {
  if (scope.none) return null;
  const where: Prisma.FacilityWhereInput = {};
  if (scope.state) where.stateName = scope.state;
  if (scope.lga) where.lgaName = scope.lga;
  return where;
}

export { formatStamp };
