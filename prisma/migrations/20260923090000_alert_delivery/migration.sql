-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "notification" ADD COLUMN "recipientAddress" TEXT;
ALTER TABLE "notification" ADD COLUMN "delivery" "DeliveryState" NOT NULL DEFAULT 'pending';
ALTER TABLE "notification" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "notification" ADD COLUMN "deliveryDetail" TEXT;
ALTER TABLE "notification" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_idx" ON "notification"("delivery", "attempts");
