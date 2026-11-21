import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  LOCKOUT_MINUTES,
  MAX_FAILED_SIGN_INS,
  recordFailedSignIn,
  signInLockout,
} from "@/lib/sign-in-throttle";

/** An address no account has, unique to this run. */
const stranger = `throttle-${Date.now()}@example.org`;
const officer = "officer.zaria@example.org";

afterAll(async () => {
  await prisma.activityLog.deleteMany({
    where: { action: "Sign-in failed", actorName: { in: [stranger, officer] } },
  });
});

describe("sign-in throttle", () => {
  it(`allows ${MAX_FAILED_SIGN_INS - 1} wrong passwords, then pauses the address`, async () => {
    for (let i = 0; i < MAX_FAILED_SIGN_INS - 1; i++) await recordFailedSignIn(stranger, "203.0.113.7");
    expect(await signInLockout(stranger)).toEqual({ locked: false });

    await recordFailedSignIn(stranger, "203.0.113.7");
    expect(await signInLockout(stranger)).toEqual({ locked: true, minutesLeft: LOCKOUT_MINUTES });
  });

  it("counts the address however it was typed", async () => {
    expect((await signInLockout(stranger.toUpperCase())).locked).toBe(true);
  });

  it("lifts the pause once the failures are older than the window", async () => {
    const later = new Date(Date.now() + (LOCKOUT_MINUTES + 1) * 60_000);
    expect(await signInLockout(stranger, later)).toEqual({ locked: false });
  });

  it("records a failure against the account, so its state coordinator sees it", async () => {
    await recordFailedSignIn(officer, null);
    const entry = await prisma.activityLog.findFirst({
      where: { action: "Sign-in failed", actorName: officer },
      include: { actor: { select: { email: true } } },
    });
    expect(entry?.actor?.email).toBe(officer);
    expect(entry?.stateName).toBe("Kaduna");
    expect(entry?.detail).toBe("Wrong email or password");
  });
});
