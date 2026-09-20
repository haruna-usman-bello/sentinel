import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** Every reporting month with data, oldest first. Resolved once per request. */
export const listPeriods = cache(async (): Promise<string[]> => {
  const rows = await prisma.caseReport.findMany({
    distinct: ["period"],
    select: { period: true },
    orderBy: { period: "asc" },
  });
  return rows.map((r) => r.period);
});

/** The latest month with data — what the sidebar counts and the sign-in screen refer to. */
export async function currentPeriod(): Promise<string> {
  const periods = await listPeriods();
  return periods[periods.length - 1] ?? new Date().toISOString().slice(0, 7);
}

/**
 * The reporting month a screen shows: `?period=YYYY-MM` when it names a month
 * that exists, otherwise the current one.
 */
export async function resolvePeriod(
  requested: string | string[] | undefined,
): Promise<{ period: string; periods: string[]; current: string }> {
  const periods = await listPeriods();
  const current = periods[periods.length - 1] ?? new Date().toISOString().slice(0, 7);
  const period =
    typeof requested === "string" && periods.includes(requested) ? requested : current;
  return { period, periods, current };
}
