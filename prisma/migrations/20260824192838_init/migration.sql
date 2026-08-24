/*
  Warnings:

  - You are about to drop the column `email` on the `OtpCode` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `OtpCode` table. All the data in the column will be lost.
  - Added the required column `identifier` to the `OtpCode` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "OtpCode_email_idx";

-- DropIndex
DROP INDEX "OtpCode_phone_idx";

-- AlterTable
ALTER TABLE "OtpCode" DROP COLUMN "email",
DROP COLUMN "phone",
ADD COLUMN     "identifier" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OtpCode_identifier_idx" ON "OtpCode"("identifier");
