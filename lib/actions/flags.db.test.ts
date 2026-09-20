import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { transitionFlagAction } from "@/lib/actions/flags";
import { prisma } from "@/lib/prisma";
import { signedIn } from "@/lib/test/db-setup";
import type { SessionUser } from "@/lib/types";

async function userByEmail(email: string): Promise<SessionUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    state: u.stateName ?? undefined,
    lga: u.lgaName ?? undefined,
    phone: u.phone ?? undefined,
  };
}

async function flagAt(code: string, period: string) {
  return prisma.flag.findFirstOrThrow({ where: { facility: { code }, period } });
}

/** Puts a flag back the way the seed left it, so the tests can run again. */
async function restore(flagId: string, status: "pending" | "investigating") {
  await prisma.$transaction([
    prisma.flag.update({ where: { id: flagId }, data: { status } }),
    prisma.flagLog.deleteMany({ where: { flagId, at: { gt: new Date(Date.now() - 60_000) } } }),
    prisma.activityLog.deleteMany({ where: { kind: "flag", at: { gt: new Date(Date.now() - 60_000) } } }),
    prisma.notification.deleteMany({ where: { at: { gt: new Date(Date.now() - 60_000) } } }),
  ]);
}

describe("transitionFlagAction", () => {
  beforeEach(() => {
    signedIn.user = null;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refuses without a session", async () => {
    const flag = await flagAt("F09", "2026-08");
    const result = await transitionFlagAction({ flagId: flag.id, to: "investigating", note: "" });
    expect(result.ok).toBe(false);
    expect((await flagAt("F09", "2026-08")).status).toBe("pending");
  });

  it("does not let an officer see, let alone act on, a flag outside their LGA", async () => {
    signedIn.user = await userByEmail("officer.zaria@example.org");
    const giwa = await flagAt("F08", "2026-08"); // Giwa LGA
    const result = await transitionFlagAction({ flagId: giwa.id, to: "investigating", note: "" });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/not visible/) });
    expect((await flagAt("F08", "2026-08")).status).toBe("pending");
  });

  it("denies an officer a confirmation with an explanation, leaving the flag unchanged", async () => {
    signedIn.user = await userByEmail("officer.kudan@example.org");
    const kudan = await flagAt("F09", "2026-08");
    const result = await transitionFlagAction({ flagId: kudan.id, to: "confirmed", note: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denial?.title).toMatch(/permission/);
      expect(result.denial?.body).toMatch(/supervisor's decision/);
    }
    expect((await flagAt("F09", "2026-08")).status).toBe("pending");
    expect(await prisma.flagLog.count({ where: { flagId: kudan.id } })).toBe(0);
  });

  it("rejects a dismissal without a reason before touching the database", async () => {
    signedIn.user = await userByEmail("supervisor.kudan@example.org");
    const kudan = await flagAt("F09", "2026-08");
    const result = await transitionFlagAction({ flagId: kudan.id, to: "false_alarm", note: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.note).toMatch(/reason/);
    expect((await flagAt("F09", "2026-08")).status).toBe("pending");
  });

  it("records an officer's investigation in the audit trail and activity log, without broadcasting", async () => {
    signedIn.user = await userByEmail("officer.kudan@example.org");
    const kudan = await flagAt("F09", "2026-08");
    const before = await prisma.notification.count();
    try {
      const result = await transitionFlagAction({ flagId: kudan.id, to: "investigating", note: "" });
      expect(result.ok).toBe(true);
      expect((await flagAt("F09", "2026-08")).status).toBe("investigating");
      const log = await prisma.flagLog.findFirst({ where: { flagId: kudan.id }, orderBy: { at: "desc" } });
      expect(log).toMatchObject({ actorName: "Kudan LGA Officer", fromStatus: "pending", toStatus: "investigating" });
      const activity = await prisma.activityLog.findFirst({ where: { kind: "flag" }, orderBy: { at: "desc" } });
      expect(activity?.detail).toMatch(/Hunkuyi PHC \/ Cholera 2026-08 → investigating/);
      expect(await prisma.notification.count()).toBe(before);
    } finally {
      await restore(kudan.id, "pending");
    }
  });

  it("escalates a supervisor's confirmation to the state and national coordinators, not to themselves", async () => {
    signedIn.user = await userByEmail("supervisor.kudan@example.org");
    const kudan = await flagAt("F09", "2026-08");
    try {
      const result = await transitionFlagAction({ flagId: kudan.id, to: "confirmed", note: "Lab confirmed." });
      expect(result).toMatchObject({ ok: true, description: expect.stringMatching(/escalated/) });
      const sent = await prisma.notification.findMany({
        where: { message: { contains: "Hunkuyi PHC" }, at: { gt: new Date(Date.now() - 60_000) } },
        select: { recipientName: true, scopeState: true, scopeLga: true, message: true },
      });
      expect(sent.map((n) => n.recipientName).sort()).toEqual([
        "Kaduna State Coordinator",
        "NCDC National Coordinator",
      ]);
      expect(sent.find((n) => n.recipientName === "NCDC National Coordinator")?.scopeState).toBeNull();
      expect(sent[0].message).toMatch(/Kudan LGA Supervisor confirmed an outbreak\. Note: Lab confirmed\./);
    } finally {
      await restore(kudan.id, "pending");
    }
  });
});
