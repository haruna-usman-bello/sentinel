"use server";

import { revalidatePath } from "next/cache";

import { dispatchSoon } from "@/lib/alerts/dispatch";
import { humanStatus, monthLabel } from "@/lib/domain";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { facilityScope, viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";
import type { FlagStatus } from "@/lib/types";
import { fieldErrors, flagTransitionSchema } from "@/lib/validation";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * Moves a flag through its lifecycle. The rules are the same ones the UI
 * draws its buttons from (`ROLES[role].can`), re-checked here because a
 * server function is reachable without the UI.
 *
 * One transaction: the status change, the audit-trail entry, the activity
 * entry and the escalation notifications land together or not at all.
 */
export async function transitionFlagAction(input: {
  flagId: string;
  to: FlagStatus;
  note: string;
}): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, role, scope } = await viewer();

  const parsed = flagTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { flagId, note } = parsed.data;
  const to = parsed.data.to as FlagStatus;

  const facility = facilityScope(scope);
  const flag = facility
    ? await prisma.flag.findFirst({
        where: { id: flagId, facility },
        include: {
          facility: { select: { name: true, lgaName: true, stateName: true } },
          disease: { select: { name: true } },
        },
      })
    : null;
  if (!flag) return { ok: false, error: "That flag is not visible to your role." };

  if (!role.can[flag.status].includes(to)) {
    return {
      ok: false,
      error: "Permission denied. The flag was not changed.",
      denial: {
        title: `You do not have permission to mark this flag “${humanStatus(to)}”.`,
        body:
          role.key === "officer"
            ? "Your role can open an investigation and record what you find. Declaring or dismissing an outbreak is your LGA supervisor's decision. The flag has been left unchanged."
            : "That change is not available for this flag at its current stage. The flag has been left unchanged.",
      },
    };
  }

  const label = `${flag.facility.name} / ${flag.disease.name} ${flag.period}`;
  const notifications = await escalations(flag, to, role.key, user.name, note);

  await prisma.$transaction([
    prisma.flag.update({ where: { id: flag.id }, data: { status: to } }),
    prisma.flagLog.create({
      data: {
        flagId: flag.id,
        actorId: user.id,
        actorName: user.name,
        fromStatus: flag.status,
        toStatus: to,
        note: note || null,
      },
    }),
    prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        stateName: scope.state ?? null,
        kind: "flag",
        action: to === "closed" ? "Flag closed" : "Flag status changed",
        detail: `${label} → ${to}`,
      },
    }),
    ...(notifications.length ? [prisma.notification.createMany({ data: notifications })] : []),
  ]);

  // Only after the decision is safely written: a slow provider must never be
  // able to roll back an outbreak confirmation.
  if (notifications.length) await dispatchSoon();

  revalidatePath("/", "layout");

  return {
    ok: true,
    message: `${flag.facility.name} — ${flag.disease.name} moved to “${humanStatus(to)}”.`,
    description: notifications.length
      ? "Logged to the audit trail and escalated."
      : "Logged to the audit trail.",
  };
}

type FlagForEscalation = {
  period: string;
  facility: { name: string; lgaName: string; stateName: string };
  disease: { name: string };
};

/**
 * Who a decision is sent to, mirroring `recipientsFor` in lib/domain.ts —
 * that one previews the list in the dialog, this one resolves the people.
 * Only a confirmation or a dismissal escalates; opening an investigation and
 * closing are recorded but not broadcast.
 */
async function escalations(
  flag: FlagForEscalation,
  to: FlagStatus,
  actorRole: string,
  actorName: string,
  note: string,
): Promise<Prisma.NotificationCreateManyInput[]> {
  if (to !== "confirmed" && to !== "false_alarm") return [];

  const { stateName, lgaName } = flag.facility;
  const recipients: Prisma.UserWhereInput[] = [];
  if (actorRole === "officer" || actorRole === "supervisor") {
    recipients.push({ role: "state", stateName });
  }
  if (to === "confirmed") recipients.push({ role: "national" });
  if (actorRole !== "supervisor") recipients.push({ role: "supervisor", stateName, lgaName });
  if (!recipients.length) return [];

  const users = await prisma.user.findMany({
    where: { active: true, OR: recipients },
    select: { id: true, name: true, role: true, phone: true },
  });

  const verb = to === "confirmed" ? "confirmed an outbreak" : "recorded a false alarm";
  const message = `Status update — ${flag.facility.name} (${lgaName} LGA), ${flag.disease.name}, ${monthLabel(flag.period)}. ${actorName} ${verb}.${note ? ` Note: ${note}` : ""}`;

  return users.map((u) => ({
    channel: u.phone ? "sms" : "email",
    recipientId: u.id,
    recipientName: u.name,
    scopeState: u.role === "national" ? null : stateName,
    scopeLga: u.role === "supervisor" ? lgaName : null,
    message,
  }));
}
