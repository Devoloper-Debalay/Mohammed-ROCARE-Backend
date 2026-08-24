-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "VendorOtp" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorOtp_identifier_idx" ON "VendorOtp"("identifier");
