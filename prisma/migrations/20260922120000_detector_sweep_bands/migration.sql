-- AlterTable
ALTER TABLE "detector_sweep" RENAME COLUMN "selected" TO "recommended";
ALTER TABLE "detector_sweep" ADD COLUMN "scored" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "detector_sweep" ADD COLUMN "corpusSeed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "detector_sweep_band" (
    "id" TEXT NOT NULL,
    "sweepId" TEXT NOT NULL,
    "fromMagnitude" DOUBLE PRECISION NOT NULL,
    "toMagnitude" DOUBLE PRECISION NOT NULL,
    "outbreaks" INTEGER NOT NULL,
    "caught" INTEGER NOT NULL,

    CONSTRAINT "detector_sweep_band_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detector_sweep_band_sweepId_idx" ON "detector_sweep_band"("sweepId");

-- AddForeignKey
ALTER TABLE "detector_sweep_band" ADD CONSTRAINT "detector_sweep_band_sweepId_fkey" FOREIGN KEY ("sweepId") REFERENCES "detector_sweep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
