/**
 * Seeds a database with the reference dataset the UI was built against, so the
 * first real database looks exactly like the demo. Destructive and idempotent:
 * every surveillance table is cleared and rebuilt on each run.
 *
 *   npx prisma db seed
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "better-auth";
import { hashPassword } from "better-auth/crypto";

import {
  ACCOUNTS,
  ACTIVITY,
  COMPLETENESS,
  DISEASES,
  EVALUATION,
  FACILITIES,
  FLAGS,
  FLAG_LOGS,
  INGEST_RUNS,
  LAST_DETECTION_RUN,
  NOTIFICATIONS,
  THRESHOLDS,
  caseSeries,
} from "../lib/data";
import { PrismaClient } from "../lib/generated/prisma/client";

/** Every account in the reference dataset signs in with this until it is changed. */
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

/** Timestamps in the dataset are West Africa Time. */
function wat(stamp: string): Date {
  return new Date(`${stamp.replace(" ", "T")}:00+01:00`);
}

/** "2026-08" → first instant of that month, WAT. */
function periodStart(period: string): Date {
  return new Date(`${period}-01T00:00:00+01:00`);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("Clearing surveillance tables…");
  await prisma.$transaction([
    prisma.flagLog.deleteMany(),
    prisma.flag.deleteMany(),
    prisma.caseReport.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.reportingCompleteness.deleteMany(),
    prisma.ingestRun.deleteMany(),
    prisma.detectorSweep.deleteMany(),
    prisma.facility.deleteMany(),
    prisma.disease.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log(`Users (${ACCOUNTS.length})…`);
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const userIdByName = new Map<string, string>();
  for (const account of ACCOUNTS) {
    // Better Auth recognises a credential account only when its accountId is the user's own id.
    const id = generateId();
    const user = await prisma.user.create({
      data: {
        id,
        name: account.name,
        email: account.email,
        emailVerified: true,
        role: account.role,
        stateName: account.state === "—" ? null : account.state,
        lgaName: account.lga === "—" ? null : account.lga,
        phone: account.phone || null,
        active: account.active,
        deactivationNote: account.note ?? null,
        accounts: {
          create: {
            providerId: "credential",
            accountId: id,
            password: passwordHash,
          },
        },
      },
    });
    userIdByName.set(account.name, user.id);
  }

  console.log(`Diseases (${DISEASES.length})…`);
  const diseaseIdByName = new Map<string, string>();
  for (const name of DISEASES) {
    const threshold = THRESHOLDS.find((t) => t.disease === name);
    const disease = await prisma.disease.create({
      data: {
        name,
        alertLevelK: threshold?.k ?? 2.0,
        setAt: threshold ? wat(threshold.setAt) : new Date(),
        setById: threshold ? (userIdByName.get(threshold.setBy) ?? null) : null,
      },
    });
    diseaseIdByName.set(name, disease.id);
  }

  console.log(`Facilities (${FACILITIES.length})…`);
  const facilityIdByCode = new Map<string, string>();
  for (const facility of FACILITIES) {
    const row = await prisma.facility.create({
      data: {
        code: facility.code,
        name: facility.name,
        lgaName: facility.lga,
        stateName: facility.state,
        mapX: facility.mapX ?? null,
        mapY: facility.mapY ?? null,
      },
    });
    facilityIdByCode.set(facility.code, row.id);
  }

  console.log("Case reports…");
  let reports = 0;
  for (const facility of FACILITIES) {
    for (const disease of Object.keys(facility.baseline)) {
      const series = caseSeries(facility.code, disease, FLAGS);
      await prisma.caseReport.createMany({
        data: series.map((point) => ({
          facilityId: facilityIdByCode.get(facility.code)!,
          diseaseId: diseaseIdByName.get(disease)!,
          period: point.period,
          count: point.count,
          ingestedAt: periodStart(point.period),
        })),
      });
      reports += series.length;
    }
  }
  console.log(`  ${reports} rows`);

  console.log(`Flags (${FLAGS.length})…`);
  const flagIdByLegacyId = new Map<string, string>();
  for (const flag of FLAGS) {
    const row = await prisma.flag.create({
      data: {
        type: flag.type,
        facilityId: facilityIdByCode.get(flag.facility)!,
        diseaseId: diseaseIdByName.get(flag.disease)!,
        period: flag.period,
        status: flag.status,
        cases: flag.cases ?? null,
        zScore: flag.z ?? null,
        thresholdK: flag.k ?? null,
        raisedAt: wat(LAST_DETECTION_RUN),
      },
    });
    flagIdByLegacyId.set(flag.id, row.id);
  }

  console.log(`Flag audit trail (${FLAG_LOGS.length})…`);
  await prisma.flagLog.createMany({
    data: FLAG_LOGS.map((log) => ({
      flagId: flagIdByLegacyId.get(log.flag)!,
      at: wat(log.at),
      actorId: userIdByName.get(log.actor) ?? null,
      actorName: log.actor,
      fromStatus: log.from,
      toStatus: log.to,
      note: log.note || null,
    })),
  });

  console.log(`Notifications (${NOTIFICATIONS.length})…`);
  await prisma.notification.createMany({
    data: NOTIFICATIONS.map((n) => ({
      at: wat(n.at),
      channel: n.channel,
      recipientId: userIdByName.get(n.recipient) ?? null,
      recipientName: n.recipient,
      scopeState: n.scope.state ?? null,
      scopeLga: n.scope.lga ?? null,
      message: n.message,
      read: n.read,
    })),
  });

  console.log(`Activity log (${ACTIVITY.length})…`);
  await prisma.activityLog.createMany({
    data: ACTIVITY.map((a) => ({
      at: wat(a.at),
      actorId: userIdByName.get(a.actor) ?? null,
      actorName: a.actor,
      stateName: a.state === "—" ? null : a.state,
      kind: a.kind,
      action: a.action,
      detail: a.detail || null,
    })),
  });

  console.log(`Ingestion runs (${INGEST_RUNS.length})…`);
  await prisma.ingestRun.createMany({
    data: INGEST_RUNS.map((r) => ({
      at: wat(r.at),
      status: r.status,
      orgUnits: r.orgUnits,
      dataElements: r.dataElements,
      periods: r.periods,
      records: r.records,
      durationMs: r.durationMs,
      note: r.note || null,
    })),
  });

  console.log(`Reporting completeness (${COMPLETENESS.length})…`);
  await prisma.reportingCompleteness.createMany({
    data: COMPLETENESS.map((c) => ({
      facilityId: facilityIdByCode.get(c.facility)!,
      expected: c.expected,
      received: c.received,
      missed: c.missed,
      silentMonths: c.silentMonths,
      lastPeriod: c.lastPeriod,
      computedAt: wat(LAST_DETECTION_RUN),
    })),
  });

  console.log(`Detector sweeps (${EVALUATION.sweep.length})…`);
  await prisma.detectorSweep.createMany({
    data: EVALUATION.sweep.map((s) => ({
      alertLevelK: s.k,
      truePositives: s.tp,
      falsePositives: s.fp,
      falseNegatives: s.fn,
      trueNegatives: s.tn,
      selected: s.selected ?? false,
      records: EVALUATION.records,
      seeded: EVALUATION.seeded,
      baselineMonths: EVALUATION.baselineMonths,
      runAt: wat(EVALUATION.lastRun),
    })),
  });

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
