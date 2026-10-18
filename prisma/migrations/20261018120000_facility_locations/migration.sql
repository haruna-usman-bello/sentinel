-- AlterTable
ALTER TABLE "facility" DROP COLUMN "mapX",
DROP COLUMN "mapY",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "lga_boundary" (
    "id" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "lgaName" TEXT NOT NULL,
    "shape" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lga_boundary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lga_boundary_stateName_lgaName_key" ON "lga_boundary"("stateName", "lgaName");

