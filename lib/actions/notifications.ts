"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { notificationScope } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/** Marks one dispatch read — only if it is one the caller oversees. */
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { role, scope } = await viewer();

  const where = notificationScope(scope, role.key);
  if (!where) return { ok: false, error: "No notifications are addressed to your role." };

  const { count } = await prisma.notification.updateMany({
    where: { ...where, id, read: false },
    data: { read: true },
  });
  if (count) revalidatePath("/", "layout");
  return { ok: true, message: "Marked read." };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { role, scope } = await viewer();

  const where = notificationScope(scope, role.key);
  if (!where) return { ok: false, error: "No notifications are addressed to your role." };

  await prisma.notification.updateMany({ where: { ...where, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
  return { ok: true, message: "All notifications marked read." };
}
