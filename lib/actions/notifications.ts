"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { notificationScope } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * Read or not belongs to whoever an alert was addressed to. A coordinator's
 * list also shows alerts sent to others, for oversight; marking those read
 * would clear them before their recipient had seen them, so these actions
 * touch only the caller's own.
 */

/** Marks one of the caller's own alerts read. */
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, role, scope } = await viewer();

  const where = notificationScope(scope, role.key);
  if (!where) return { ok: false, error: "No notifications are addressed to your role." };

  const { count } = await prisma.notification.updateMany({
    where: { ...where, id, recipientId: user.id, read: false },
    data: { read: true },
  });
  if (count) revalidatePath("/", "layout");
  return { ok: true, message: "Marked read." };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, role, scope } = await viewer();

  const where = notificationScope(scope, role.key);
  if (!where) return { ok: false, error: "No notifications are addressed to your role." };

  await prisma.notification.updateMany({
    where: { ...where, recipientId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "All your notifications marked read." };
}
