-- AlterTable
ALTER TABLE "disease" ADD COLUMN "dhis2DataElement" TEXT;

-- AlterTable
ALTER TABLE "facility" ADD COLUMN "dhis2OrgUnit" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "disease_dhis2DataElement_key" ON "disease"("dhis2DataElement");

-- CreateIndex
CREATE UNIQUE INDEX "facility_dhis2OrgUnit_key" ON "facility"("dhis2OrgUnit");
