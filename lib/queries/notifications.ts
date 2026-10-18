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

/**
 * A dispatch as one viewer sees it. Read or not is its recipient's state, so
 * only the recipient may change it — `mine` says whether that is the viewer.
 * Everything else on the list is there to oversee.
 */
export interface NotificationView extends Notification {
  mine: boolean;
}

export async function listNotifications(
  scope: Scope,
  role: Role,
  viewerId: string,
): Promise<NotificationView[]> {
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
    mine: r.recipientId === viewerId,
  }));
}

/** The sidebar badge: alerts addressed to this person, on their list, that they have not read. */
export async function countUnreadNotifications(
  scope: Scope,
  role: Role,
  viewerId: string,
): Promise<number> {
  const where = notificationScope(scope, role);
  if (!where) return 0;
  return prisma.notification.count({ where: { ...where, recipientId: viewerId, read: false } });
}

/** Whether any alert channel is configured, so a screen can say so plainly. */
export function alertChannels(): { sms: boolean; email: boolean } {
  return liveTransport().channels;
}
