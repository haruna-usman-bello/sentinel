import "server-only";

import { prisma } from "@/lib/prisma";

/** Wrong passwords allowed for one email address within the window before it is locked. */
export const MAX_FAILED_SIGN_INS = 5;
/** How far back failures count, and so how long a lock lasts at most. */
export const LOCKOUT_MINUTES = 15;

const FAILED = "Sign-in failed";

/**
 * Whether sign-in is paused for an email address, and for how long.
 *
 * Better Auth's own rate limit only covers requests to its HTTP routes, and
 * the sign-in form calls it from a server action, so that limit never applies
 * here. Failures are counted per email address, whether or not an account
 * has it, so the lock says nothing about which addresses exist. They are
 * counted from the activity log, where every failure is recorded anyway.
 */
export async function signInLockout(
  email: string,
  now: Date = new Date(),
): Promise<{ locked: false } | { locked: true; minutesLeft: number }> {
  const since = new Date(now.getTime() - LOCKOUT_MINUTES * 60_000);
  const failures = await prisma.activityLog.findMany({
    where: { kind: "auth", action: FAILED, actorName: email.toLowerCase(), at: { gte: since } },
    select: { at: true },
    orderBy: { at: "desc" },
    take: MAX_FAILED_SIGN_INS,
  });
  if (failures.length < MAX_FAILED_SIGN_INS) return { locked: false };
  // The lock lifts once the oldest of the last few failures leaves the window.
  const oldest = failures[failures.length - 1].at;
  const liftsAt = oldest.getTime() + LOCKOUT_MINUTES * 60_000;
  return { locked: true, minutesLeft: Math.max(1, Math.ceil((liftsAt - now.getTime()) / 60_000)) };
}

/**
 * Records a refused sign-in. It goes against the account when the address
 * belongs to one, so the state coordinator sees it in their activity log.
 */
export async function recordFailedSignIn(email: string, ipAddress: string | null): Promise<void> {
  const address = email.toLowerCase();
  const account = await prisma.user.findFirst({
    where: { email: { equals: address, mode: "insensitive" } },
    select: { id: true, stateName: true },
  });
  await prisma.activityLog.create({
    data: {
      actorId: account?.id ?? null,
      actorName: address,
      stateName: account?.stateName ?? null,
      kind: "auth",
      action: FAILED,
      detail: `Wrong email or password${ipAddress ? ` from ${ipAddress}` : ""}`,
    },
  });
}
