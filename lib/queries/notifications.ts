import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { liveTransport } from "@/lib/alerts/transport";
import { prisma } from "@/lib/prisma";
import type { Notification, Role, Scope } from "@/lib/types";

import { formatStamp } from "./shared";

/**
 * Prisma `where` for the dispatches a role oversees, matching
 * `scopedNotifications` in lib/domain.ts: national sees every dispatch, a
 * state coordinator everything sent within the state, an LGA role only what
 * was addressed to their LGA, and the administrator nothing. Null means
 * nothing.
 */
export function notificationScope(scope: Scope, role: Role): Prisma.NotificationWhereInput | null {
  if (role === "national") return {};
  if (scope.none) return null;
  if (scope.lga) return { scopeState: scope.state, scopeLga: scope.lga };
  if (scope.state) return { scopeState: scope.state };
  return {};
}

export async function listNotifications(scope: Scope, role: Role): Promise<Notification[]> {
  const where = notificationScope(scope, role);
  if (!where) return [];
  const rows = await prisma.notification.findMany({ where, orderBy: { at: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    at: formatStamp(r.at),
    channel: r.channel,
    recipient: r.recipientName,
    scope: { state: r.scopeState ?? undefined, lga: r.scopeLga ?? undefined },
    message: r.message,
    read: r.read,
    delivery: r.delivery,
    address: r.recipientAddress ?? undefined,
    deliveryDetail: r.deliveryDetail ?? undefined,
  }));
}

/** The sidebar badge. */
export async function countUnreadNotifications(scope: Scope, role: Role): Promise<number> {
  const where = notificationScope(scope, role);
  if (!where) return 0;
  return prisma.notification.count({ where: { ...where, read: false } });
}

/** Whether any alert channel is configured, so a screen can say so plainly. */
export function alertChannels(): { sms: boolean; email: boolean } {
  return liveTransport().channels;
}
