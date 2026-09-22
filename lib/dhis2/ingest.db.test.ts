import { afterAll, describe, expect, it } from "vitest";

import { runIngestion } from "@/lib/dhis2/ingest";
import { fixtureTransport, type DataValue } from "@/lib/dhis2/client";
import { runDetection } from "@/lib/detector/run";
import { prisma } from "@/lib/prisma";

/**
 * Exercises a whole cycle against the seeded database: a month arrives from
 * DHIS2, detection scores it, flags are raised and the people responsible
 * are notified. Everything the cycle writes is removed afterwards, so the
 * database is left as the seed made it.
 */

/** The month after the last one the seed loaded — nothing exists for it yet. */
async function freshPeriod(): Promise<string> {
  const last = await prisma.caseReport.findFirst({
    orderBy: { period: "desc" },
    select: { period: true },
  });
  const [year, month] = last!.period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

const ORG_UNITS: Record<string, string> = { F01: "OU_F01", F05: "OU_F05", F02: "OU_F02" };
const ELEMENTS: Record<string, string> = { Cholera: "DE_CHOL", Measles: "DE_MEAS" };

async function mapToDhis2() {
  for (const [code, orgUnit] of Object.entries(ORG_UNITS)) {
    await prisma.facility.update({ where: { code }, data: { dhis2OrgUnit: orgUnit } });
  }
  for (const [name, element] of Object.entries(ELEMENTS)) {
    await prisma.disease.update({ where: { name }, data: { dhis2DataElement: element } });
  }
}

async function unmap() {
  await prisma.facility.updateMany({ data: { dhis2OrgUnit: null } });
  await prisma.disease.updateMany({ data: { dhis2DataElement: null } });
}

async function cleanup(since: Date, period: string) {
  await prisma.flagLog.deleteMany({ where: { flag: { period } } });
  await prisma.flag.deleteMany({ where: { period } });
  await prisma.caseReport.deleteMany({ where: { period } });
  await prisma.notification.deleteMany({ where: { at: { gte: since } } });
  await prisma.activityLog.deleteMany({ where: { at: { gte: since } } });
  await prisma.ingestRun.deleteMany({ where: { at: { gte: since } } });
  await unmap();
}

describe("a monthly cycle", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("pulls a month, scores it, raises flags and notifies the right people", async () => {
    const period = await freshPeriod();
    const since = new Date();
    await mapToDhis2();

    // Zaria General Hospital reports a sharp rise in cholera; Tudun Wada Clinic
    // reports normally; Sabon Gari PHC, which has never missed a month, reports
    // nothing at all.
    const dhis2Period = period.replace("-", "");
    const values: DataValue[] = [
      { orgUnit: "OU_F01", dataElement: "DE_CHOL", period: dhis2Period, value: "58" },
      { orgUnit: "OU_F01", dataElement: "DE_MEAS", period: dhis2Period, value: "7" },
      { orgUnit: "OU_F05", dataElement: "DE_CHOL", period: dhis2Period, value: "9" },
      { orgUnit: "OU_F05", dataElement: "DE_MEAS", period: dhis2Period, value: "5" },
    ];

    try {
      const run = await runIngestion({ period, transport: fixtureTransport(values) });

      expect(run.status).toBe("warn"); // Sabon Gari PHC returned nothing
      expect(run.records).toBe(4);
      expect(run.detection).not.toBeNull();

      // The pull is recorded as a run of its own.
      const logged = await prisma.ingestRun.findFirst({ orderBy: { at: "desc" } });
      expect(logged?.records).toBe(4);

      // The months nothing arrived for are held as nulls, not left absent —
      // that is what the non-reporting rule reads.
      const silent = await prisma.caseReport.findMany({
        where: { facility: { code: "F02" }, period },
        select: { count: true },
      });
      expect(silent.length).toBeGreaterThan(0);
      expect(silent.every((r) => r.count === null)).toBe(true);

      const raised = await prisma.flag.findMany({
        where: { period },
        include: { facility: { select: { code: true } }, disease: { select: { name: true } } },
      });
      const summary = raised.map((f) => `${f.facility.code}/${f.disease.name}/${f.type}`).sort();

      expect(summary).toContain("F01/Cholera/statistical");
      expect(summary).toContain("F02/Measles/non_reporting");
      expect(summary).toContain("F02/Cholera/non_reporting");
      expect(summary).not.toContain("F05/Cholera/statistical"); // a normal month
      expect(summary).not.toContain("F01/Measles/statistical"); // steady at its usual level

      const spike = raised.find((f) => f.facility.code === "F01" && f.type === "statistical")!;
      expect(spike.cases).toBe(58);
      expect(spike.zScore!).toBeGreaterThan(spike.thresholdK!);

      // The LGA supervisor and the state coordinator are told; nobody else is.
      const told = await prisma.notification.findMany({
        where: { at: { gte: since }, message: { contains: "Zaria General Hospital" } },
        select: { recipientName: true, message: true, scopeLga: true },
      });
      expect(told.map((n) => n.recipientName).sort()).toEqual([
        "Kaduna State Coordinator",
        "Zaria LGA Supervisor",
      ]);
      expect(told[0].message).toMatch(/Unusual rise — Zaria General Hospital \(Zaria LGA\), Cholera/);

      const silence = await prisma.notification.findFirst({
        where: { at: { gte: since }, message: { contains: "Sabon Gari PHC" } },
        select: { recipientName: true, message: true },
      });
      expect(silence?.message).toMatch(/No report — Sabon Gari PHC \(Sabon Gari LGA\)/);

      // The run itself is on the record.
      const activity = await prisma.activityLog.findFirst({
        where: { at: { gte: since }, action: "Detection run completed" },
      });
      expect(activity?.actorName).toBe("Detection engine");
    } finally {
      await cleanup(since, period);
    }
  });

  it("leaves an existing flag and its decisions alone when detection re-runs", async () => {
    const period = await freshPeriod();
    const since = new Date();
    await mapToDhis2();
    const dhis2Period = period.replace("-", "");

    try {
      await runIngestion({
        period,
        transport: fixtureTransport([
          { orgUnit: "OU_F01", dataElement: "DE_CHOL", period: dhis2Period, value: "58" },
        ]),
      });

      const flag = await prisma.flag.findFirstOrThrow({
        where: { period, facility: { code: "F01" }, type: "statistical" },
      });
      // Someone picks it up and confirms it.
      await prisma.flag.update({ where: { id: flag.id }, data: { status: "confirmed" } });

      const second = await runDetection(period);
      expect(second.raised).toBe(0);

      const after = await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } });
      expect(after.status).toBe("confirmed");
      expect(await prisma.flag.count({ where: { period, facilityId: flag.facilityId, diseaseId: flag.diseaseId } })).toBe(1);
    } finally {
      await cleanup(since, period);
    }
  });

  it("records a failed pull without changing any case count", async () => {
    const period = await freshPeriod();
    const since = new Date();
    await mapToDhis2();
    const before = await prisma.caseReport.count();

    try {
      const run = await runIngestion({
        period,
        transport: {
          fetchDataValueSet: async () => {
            throw new Error("connect ETIMEDOUT");
          },
        },
      });

      expect(run.status).toBe("fail");
      expect(run.detection).toBeNull();
      expect(run.note).toMatch(/detection did not run/);
      expect(await prisma.caseReport.count()).toBe(before);
      expect(await prisma.flag.count({ where: { period } })).toBe(0);

      const logged = await prisma.ingestRun.findFirst({ orderBy: { at: "desc" } });
      expect(logged?.status).toBe("fail");
    } finally {
      await cleanup(since, period);
    }
  });
});
