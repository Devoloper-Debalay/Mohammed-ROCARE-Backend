/*
  Warnings:

  - A unique constraint covering the columns `[reviewToken]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reviewToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reviewToken_key" ON "Payment"("reviewToken");
