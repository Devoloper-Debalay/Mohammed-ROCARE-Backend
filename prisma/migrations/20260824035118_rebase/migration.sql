-- CreateEnum
CREATE TYPE "VendorRole" AS ENUM ('AGENT', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "VendorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorProfileStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('RECHARGE', 'LEAD_ACCEPT', 'LEAD_REFUND', 'PRODUCT_PURCHASE', 'PART_PURCHASE', 'COMMISSION_CREDIT', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'WITHDRAWAL', 'BONUS', 'OFFER_REWARD');

-- CreateEnum
CREATE TYPE "WalletTxnStatus" AS ENUM ('SUCCESS', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'CREDITED', 'REVERSED');

-- CreateEnum
CREATE TYPE "VendorComplaintCategory" AS ENUM ('WALLET', 'LEAD', 'PAYMENT', 'PRODUCT', 'TECHNICAL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('COUPON', 'VOUCHER', 'CASHBACK', 'PRODUCT_DISCOUNT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'PENDING_START_VERIFICATION';
ALTER TYPE "LeadStatus" ADD VALUE 'PENDING_DENIAL_VERIFICATION';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "area" TEXT,
ADD COLUMN     "assignedVendorId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deniedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "estimatedAmount" DECIMAL(10,2),
ADD COLUMN     "issue" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "leadAcceptanceCharge" DECIMAL(10,2),
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "serviceType" TEXT,
ADD COLUMN     "startVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'VERIFY',
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "qrPayload" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "role" "VendorRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "profilePhoto" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "experienceYears" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialization" TEXT,
    "verificationStatus" "VendorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "profileStatus" "VendorProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "referralCode" TEXT,
    "referredByVendorId" TEXT,
    "deletionRequested" BOOLEAN NOT NULL DEFAULT false,
    "deletionReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorKYC" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "aadhaarNumber" TEXT,
    "aadhaarFrontImage" TEXT,
    "aadhaarBackImage" TEXT,
    "panNumber" TEXT,
    "panImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorKYC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBankDetail" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "upiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBankDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRecharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "status" "WalletTxnStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2),
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadVisitProof" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "image" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadVisitProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDenialProof" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDenialProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadProgress" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "note" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "partsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "transactionId" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorComplaint" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" "VendorComplaintCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VendorComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "OfferType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferReward" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "OfferReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_phone_key" ON "Vendor"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_email_key" ON "Vendor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_referralCode_key" ON "Vendor"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "VendorKYC_vendorId_key" ON "VendorKYC"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBankDetail_vendorId_key" ON "VendorBankDetail"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_vendorId_key" ON "Wallet"("vendorId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_leadId_key" ON "Review"("leadId");

-- CreateIndex
CREATE INDEX "Review_vendorId_rating_idx" ON "Review"("vendorId", "rating");

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "LeadAssignment_vendorId_idx" ON "LeadAssignment"("vendorId");

-- CreateIndex
CREATE INDEX "LeadProgress_leadId_createdAt_idx" ON "LeadProgress"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_leadId_key" ON "Commission"("leadId");

-- CreateIndex
CREATE INDEX "OtpCode_phone_idx" ON "OtpCode"("phone");

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_referredByVendorId_fkey" FOREIGN KEY ("referredByVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorKYC" ADD CONSTRAINT "VendorKYC_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBankDetail" ADD CONSTRAINT "VendorBankDetail_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadVisitProof" ADD CONSTRAINT "LeadVisitProof_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadVisitProof" ADD CONSTRAINT "LeadVisitProof_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDenialProof" ADD CONSTRAINT "LeadDenialProof_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDenialProof" ADD CONSTRAINT "LeadDenialProof_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadProgress" ADD CONSTRAINT "LeadProgress_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadProgress" ADD CONSTRAINT "LeadProgress_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorComplaint" ADD CONSTRAINT "VendorComplaint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferReward" ADD CONSTRAINT "OfferReward_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferReward" ADD CONSTRAINT "OfferReward_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
