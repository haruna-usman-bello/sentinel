"use server";

import { revalidatePath } from "next/cache";

import { runIngestion } from "@/lib/dhis2/ingest";
import { monthLabel } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";

import { alertLevelSchema, fieldErrors } from "@/lib/validation";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * Pulls the current month from DHIS2 (or, without a live instance, skips the
 * pull) and re-runs detection, then reports what happened. Available to every
 * role with a period-scoped screen, since each of them is waiting on the
 * result; the run itself is recorded under the requester's name.
 */
export async function requestRefreshAction(): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, scope } = await viewer();

  await prisma.activityLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      stateName: scope.state ?? null,
      kind: "config",
      action: "Data refresh requested",
      detail: `${user.name} triggered a DHIS2 pull and detection re-run`,
    },
  });

  const run = await runIngestion();
  revalidatePath("/", "layout");

  if (run.status === "fail") {
    return { ok: false, error: `The pull failed: ${run.note}` };
  }
  const raised = run.detection?.raised ?? 0;
  return {
    ok: true,
    message:
      run.status === "ok"
        ? `Pulled ${run.records} records for ${monthLabel(run.period)}.`
        : `Detection re-ran for ${monthLabel(run.period)}.`,
    description: raised
      ? `${raised} new flag${raised === 1 ? "" : "s"} raised — they are on the screen now.`
      : run.status === "ok"
        ? "No new flags this run."
        : run.note,
  };
}

/**
 * Sets the national alert level for a disease. It is set once per disease
 * so states stay comparable, which is why only the national coordinator
 * may change it; it applies at the next detection run.
 */
export async function setAlertLevelAction(input: unknown): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, role } = await viewer();
  if (role.key !== "national") {
    return { ok: false, error: "Only the national coordinator can change an alert level." };
  }

  const parsed = alertLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { disease, k } = parsed.data;

  const previous = await prisma.disease.findUnique({ where: { name: disease } });
  if (!previous) return { ok: false, error: "That disease is not under surveillance." };

  await prisma.$transaction([
    prisma.disease.update({
      where: { id: previous.id },
      data: { alertLevelK: k, setAt: new Date(), setById: user.id },
    }),
    prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        stateName: null,
        kind: "config",
        action: "Alert level changed",
        detail: `${disease} ${previous.alertLevelK.toFixed(1)}× → ${k.toFixed(1)}×`,
      },
    }),
  ]);

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${disease} alert level set to ${k.toFixed(1)}×.`,
    description: "It applies at the next detection run.",
  };
}
