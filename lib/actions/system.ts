"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/**
 * Asks for a fresh DHIS2 pull and detection run. Until the detector is wired
 * in, the request itself is what gets recorded.
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

  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Refresh requested.",
    description: "New flags will appear here once the pull and detection complete.",
  };
}
