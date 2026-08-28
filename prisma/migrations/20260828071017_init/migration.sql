/*
  Warnings:

  - A unique constraint covering the columns `[serviceRequestId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "serviceRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_serviceRequestId_key" ON "Lead"("serviceRequestId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
