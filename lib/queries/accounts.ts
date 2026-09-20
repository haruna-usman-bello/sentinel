import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccountRecord, Role, Scope } from "@/lib/types";

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  stateName: true,
  lgaName: true,
  phone: true,
  active: true,
  deactivationNote: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof select }>;

export function toAccount(u: UserRow): AccountRecord {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    state: u.stateName ?? "—",
    lga: u.lgaName ?? "—",
    phone: u.phone ?? "",
    email: u.email,
    active: u.active,
    note: u.deactivationNote ?? undefined,
  };
}

/**
 * Prisma `where` for the accounts a role administers: the administrator
 * every account, a state coordinator those posted in their state. Null for
 * a role that administers none.
 */
export function accountScope(scope: Scope, role: Role): Prisma.UserWhereInput | null {
  if (role === "sysadmin") return {};
  if (role === "state" && scope.state) return { stateName: scope.state };
  return null;
}

export async function listAccounts(scope: Scope, role: Role): Promise<AccountRecord[]> {
  const where = accountScope(scope, role);
  if (!where) return [];
  const rows = await prisma.user.findMany({ where, select, orderBy: { createdAt: "asc" } });
  return rows.map(toAccount);
}

export interface PostingOptions {
  states: string[];
  lgasByState: Record<string, string[]>;
}

/** The states and LGAs an account can be posted to: wherever a facility reports from or an account already sits. */
export async function listPostings(scope: Scope, role: Role): Promise<PostingOptions> {
  const stateFilter = role === "sysadmin" ? {} : { stateName: scope.state ?? "" };
  const [facilities, users] = await Promise.all([
    prisma.facility.findMany({
      where: stateFilter,
      distinct: ["stateName", "lgaName"],
      select: { stateName: true, lgaName: true },
    }),
    prisma.user.findMany({
      where: { ...stateFilter, stateName: { not: null } },
      distinct: ["stateName", "lgaName"],
      select: { stateName: true, lgaName: true },
    }),
  ]);
  const lgasByState: Record<string, Set<string>> = {};
  for (const row of [...facilities, ...users]) {
    if (!row.stateName) continue;
    lgasByState[row.stateName] ??= new Set();
    if (row.lgaName) lgasByState[row.stateName].add(row.lgaName);
  }
  const states = Object.keys(lgasByState).sort();
  return {
    states,
    lgasByState: Object.fromEntries(states.map((s) => [s, [...lgasByState[s]].sort()])),
  };
}
