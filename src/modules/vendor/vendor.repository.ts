import { injectable, inject } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/client";
import { LeadStatus, VendorProfileStatus, VendorRole, VendorVerificationStatus } from "../../generated/prisma/enums";

const PROFILE_INCLUDE = {
  kyc: true,
  bankDetail: true,
} as const;

@injectable()
export class VendorRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.vendor.findUnique({ where: { id }, include: PROFILE_INCLUDE });
  }

  findByVendorCode(vendorCode: string) {
    return this.prisma.vendor.findUnique({ where: { vendorCode }, include: PROFILE_INCLUDE });
  }

  findByPhone(phone: string) {
    return this.prisma.vendor.findUnique({ where: { phone } });
  }

  findByEmail(email: string) {
    return this.prisma.vendor.findUnique({ where: { email } });
  }

  findByReferralCode(referralCode: string) {
    return this.prisma.vendor.findUnique({ where: { referralCode } });
  }

  create(data: {
    vendorCode: string;
    role: "AGENT" | "TECHNICIAN";
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    referralCode?: string;
    referredByVendorId?: string;
  }) {
    return this.prisma.vendor.create({
      data: {
        ...data,
        // wallet is created alongside the vendor so every vendor always has one
        wallet: { create: {} },
      },
    });
  }

  updateProfile(id: string, data: Record<string, unknown>) {
    return this.prisma.vendor.update({ where: { id }, data });
  }

  updatePassword(id: string, password: string) {
    return this.prisma.vendor.update({ where: { id }, data: { password } });
  }

  upsertKyc(vendorId: string, data: Record<string, unknown>) {
    return this.prisma.vendorKYC.upsert({
      where: { vendorId },
      update: data,
      create: { vendorId, ...data },
    });
  }

  upsertBankDetail(vendorId: string, data: { bankAccount: string; ifsc: string; upiId?: string }) {
    return this.prisma.vendorBankDetail.upsert({
      where: { vendorId },
      update: data,
      create: { vendorId, ...data },
    });
  }

  requestDeletion(vendorId: string, reason: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { deletionRequested: true, deletionReason: reason },
    });
  }

  softDelete(vendorId: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deletedAt: new Date(),
        profileStatus: VendorProfileStatus.DELETED,
      },
    });
  }

  submitForVerification(vendorId: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { profileStatus: VendorProfileStatus.UNDER_REVIEW },
    });
  }

  setVerificationStatus(
    vendorId: string,
    verificationStatus: VendorVerificationStatus,
    rejectionReason?: string
  ) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        verificationStatus,
        rejectionReason: rejectionReason ?? null,
        // Approving verification doesn't auto-publish — that's a distinct
        // admin action per the signup flow (Verified -> Published).
      },
    });
  }

  publish(vendorId: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { profileStatus: VendorProfileStatus.PUBLISHED },
    });
  }

  listPending(skip: number, take: number) {
    return this.prisma.vendor.findMany({
      where: { verificationStatus: VendorVerificationStatus.PENDING, deletedAt: null },
      include: PROFILE_INCLUDE,
      skip,
      take,
      orderBy: { createdAt: "asc" },
    });
  }

  countPending() {
    return this.prisma.vendor.count({
      where: { verificationStatus: VendorVerificationStatus.PENDING, deletedAt: null },
    });
  }

  wallet(vendorId: string) { return this.prisma.wallet.findUnique({ where: { vendorId } }); }
  walletHistory(vendorId: string, skip: number, take: number) {
    return this.prisma.walletTransaction.findMany({ where: { wallet: { vendorId } }, orderBy: { createdAt: "desc" }, skip, take });
  }
  walletHistoryCount(vendorId: string) { return this.prisma.walletTransaction.count({ where: { wallet: { vendorId } } }); }

  technicianLeads(vendorId: string, skip: number, take: number) {
    return this.prisma.lead.findMany({ where: { assignedVendorId: vendorId }, orderBy: { createdAt: "desc" }, skip, take });
  }
  technicianLeadCount(vendorId: string) { return this.prisma.lead.count({ where: { assignedVendorId: vendorId } }); }
  lead(id: string) { return this.prisma.lead.findUnique({ where: { id }, include: { visitProofs: true, denialProofs: true, progressLogs: true, payments: true, review: true } }); }

  notifications(vendorId: string, skip: number, take: number) {
    return this.prisma.notification.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, skip, take });
  }
  notificationCount(vendorId: string) { return this.prisma.notification.count({ where: { vendorId } }); }
  offers(vendorId: string) { return this.prisma.offerReward.findMany({ where: { vendorId }, include: { offer: true }, orderBy: { grantedAt: "desc" } }); }
  complaints(vendorId: string) { return this.prisma.vendorComplaint.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" } }); }
  products() { return this.prisma.product.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }); }
  parts() { return this.prisma.part.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }); }
}
