import { afterAll, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/jobs/ingest/route";
import { prisma } from "@/lib/prisma";

/**
 * The job Vercel Cron calls on the 5th of each month, against the seeded
 * database, whose newest month is August 2026. Without a DHIS2 instance the
 * job pulls nothing and re-runs detection, which is enough to see which month
 * it took.
 */
describe("the scheduled monthly job", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("takes the month that has just ended, not the newest month already held", async () => {
    const since = new Date();
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T05:00:00Z"));

    try {
      const response = await GET(
        new Request("http://localhost/api/jobs/ingest", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );
      const run = await response.json();
      expect(run.period).toBe("2026-10");
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      await prisma.flagLog.deleteMany({ where: { flag: { period: "2026-10" } } });
      await prisma.flag.deleteMany({ where: { period: "2026-10" } });
      await prisma.caseReport.deleteMany({ where: { period: "2026-10" } });
      await prisma.notification.deleteMany({ where: { at: { gte: since } } });
      await prisma.activityLog.deleteMany({ where: { at: { gte: since } } });
      await prisma.ingestRun.deleteMany({ where: { at: { gte: since } } });
    }
  });

  it("turns away a request without the job's secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    try {
      const response = await GET(new Request("http://localhost/api/jobs/ingest"));
      expect(response.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
