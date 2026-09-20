-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('officer', 'supervisor', 'state', 'national', 'sysadmin');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('statistical', 'non_reporting');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('pending', 'investigating', 'confirmed', 'false_alarm', 'closed');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('auth', 'config', 'account', 'flag');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('ok', 'warn', 'fail');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL,
    "stateName" TEXT,
    "lgaName" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivationNote" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disease" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alertLevelK" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" TEXT,

    CONSTRAINT "disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lgaName" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,

    CONSTRAINT "facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_report" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag" (
    "id" TEXT NOT NULL,
    "type" "FlagType" NOT NULL,
    "facilityId" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'pending',
    "cases" INTEGER,
    "zScore" DOUBLE PRECISION,
    "thresholdK" DOUBLE PRECISION,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_log" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "fromStatus" "FlagStatus",
    "toStatus" "FlagStatus" NOT NULL,
    "note" TEXT,

    CONSTRAINT "flag_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "NotificationChannel" NOT NULL,
    "recipientId" TEXT,
    "recipientName" TEXT NOT NULL,
    "scopeState" TEXT,
    "scopeLga" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "stateName" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_run" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "IngestStatus" NOT NULL,
    "orgUnits" INTEGER NOT NULL DEFAULT 0,
    "dataElements" INTEGER NOT NULL DEFAULT 0,
    "periods" INTEGER NOT NULL DEFAULT 0,
    "records" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "ingest_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_completeness" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "received" INTEGER NOT NULL,
    "missed" INTEGER NOT NULL,
    "silentMonths" INTEGER NOT NULL DEFAULT 0,
    "lastPeriod" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_completeness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detector_sweep" (
    "id" TEXT NOT NULL,
    "alertLevelK" DOUBLE PRECISION NOT NULL,
    "truePositives" INTEGER NOT NULL,
    "falsePositives" INTEGER NOT NULL,
    "falseNegatives" INTEGER NOT NULL,
    "trueNegatives" INTEGER NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "records" INTEGER NOT NULL,
    "seeded" INTEGER NOT NULL,
    "baselineMonths" INTEGER NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detector_sweep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_stateName_lgaName_idx" ON "user"("stateName", "lgaName");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "disease_name_key" ON "disease"("name");

-- CreateIndex
CREATE UNIQUE INDEX "facility_code_key" ON "facility"("code");

-- CreateIndex
CREATE INDEX "facility_stateName_lgaName_idx" ON "facility"("stateName", "lgaName");

-- CreateIndex
CREATE INDEX "case_report_period_idx" ON "case_report"("period");

-- CreateIndex
CREATE UNIQUE INDEX "case_report_facilityId_diseaseId_period_key" ON "case_report"("facilityId", "diseaseId", "period");

-- CreateIndex
CREATE INDEX "flag_status_idx" ON "flag"("status");

-- CreateIndex
CREATE INDEX "flag_period_idx" ON "flag"("period");

-- CreateIndex
CREATE UNIQUE INDEX "flag_facilityId_diseaseId_period_type_key" ON "flag"("facilityId", "diseaseId", "period", "type");

-- CreateIndex
CREATE INDEX "flag_log_flagId_at_idx" ON "flag_log"("flagId", "at");

-- CreateIndex
CREATE INDEX "notification_recipientId_read_idx" ON "notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "activity_log_at_idx" ON "activity_log"("at");

-- CreateIndex
CREATE INDEX "activity_log_kind_idx" ON "activity_log"("kind");

-- CreateIndex
CREATE INDEX "ingest_run_at_idx" ON "ingest_run"("at");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_completeness_facilityId_key" ON "reporting_completeness"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "detector_sweep_alertLevelK_key" ON "detector_sweep"("alertLevelK");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease" ADD CONSTRAINT "disease_setById_fkey" FOREIGN KEY ("setById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_report" ADD CONSTRAINT "case_report_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_report" ADD CONSTRAINT "case_report_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "disease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "disease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_log" ADD CONSTRAINT "flag_log_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_log" ADD CONSTRAINT "flag_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_completeness" ADD CONSTRAINT "reporting_completeness_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

