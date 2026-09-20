import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActivityEntry, Role, Scope } from "@/lib/types";

import { formatStamp } from "./shared";

function toEntry(r: Prisma.ActivityLogGetPayload<object>): ActivityEntry {
  return {
    id: r.id,
    at: formatStamp(r.at),
    actor: r.actorName,
    state: r.stateName ?? "—",
    kind: r.kind,
    action: r.action,
    detail: r.detail ?? "",
  };
}

/**
 * The system log a role may read: everything for the administrator and
 * national, and for a state coordinator what happened in their state plus
 * system-wide events. Null for a role with no log.
 */
export function activityScope(scope: Scope, role: Role): Prisma.ActivityLogWhereInput | null {
  if (role === "sysadmin" || role === "national") return {};
  if (role === "state" && scope.state) return { OR: [{ stateName: scope.state }, { stateName: null }] };
  return null;
}

export async function listActivity(scope: Scope, role: Role): Promise<ActivityEntry[]> {
  const where = activityScope(scope, role);
  if (!where) return [];
  const rows = await prisma.activityLog.findMany({ where, orderBy: { at: "desc" } });
  return rows.map(toEntry);
}

/** What one person did most recently, for their own account screen. */
export async function recentActivityFor(userId: string, limit = 4): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { actorId: userId },
    orderBy: { at: "desc" },
    take: limit,
  });
  return rows.map(toEntry);
}
