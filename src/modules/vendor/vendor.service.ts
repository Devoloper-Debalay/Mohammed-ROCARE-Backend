import { injectable, inject } from "tsyringe";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { VendorRepository } from "./vendor.repository";
import { uploadVendorDocument } from "../../utils/uploadVendorDocument";
import { ProofInput, VendorPublicProfile } from "./vendor.types";
import { CommissionStatus, LeadStatus, ServiceRequestStatus, OfferType, PaymentMethod, PaymentStatus, VendorComplaintCategory, VendorComplaintStatus, VendorProfileStatus, VendorRole, WalletTxnStatus, WalletTxnType } from "../../generated/prisma/enums";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { sendMail } from "../../utils/mailer";
import {
  submittedForReviewEmail,
  deletionRequestedEmail,
  passwordChangedEmail,
  accountRestrictedEmail,
} from "../../utils/vendorMailTemplates";

const SALT_ROUNDS = 10;
export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_LEAD_CHARGE = 10;

@injectable()
export class VendorService {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient, @inject(VendorRepository) private readonly vendorRepo: VendorRepository) { }

  private maskPhone(phone?: string | null) {
    if (!phone) return null;

    if (phone.length <= 4) {
      return "*".repeat(phone.length);
    }

    return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
  }

  private maskAddress(
    address?: string | null,
    area?: string | null,
  ) {
    if (!address) {
      return area ?? null;
    }

    const parts = address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 2) {
      return parts.map(() => "********").join(", ");
    }

    return parts
      .map((part, index) => {
        // Hide exact house/street information
        if (index < parts.length - 3) {
          return "********";
        }

        // Keep city/state visible
        if (index === parts.length - 3 || index === parts.length - 2) {
          return part;
        }

        // Mask pincode
        return part.replace(/\d/g, "*");
      })
      .join(", ");
  }

  private toPublicProfile(vendor: any): VendorPublicProfile {
    return {
      id: vendor.id,
      vendorCode: vendor.vendorCode,
      role: vendor.role,
      fullName: vendor.fullName,
      phone: vendor.phone,
      email: vendor.email ?? null,
      profilePhoto: vendor.profilePhoto ?? null,
      address: vendor.address ?? null,
      city: vendor.city ?? null,
      state: vendor.state ?? null,
      pincode: vendor.pincode ?? null,
      latitude: vendor.latitude ?? null,
      longitude: vendor.longitude ?? null,
      experienceYears: vendor.experienceYears ?? null,
      skills: vendor.skills ?? [],
      specialization: vendor.specialization ?? null,
      verificationStatus: vendor.verificationStatus,
      profileStatus: vendor.profileStatus,
      rejectionReason: vendor.rejectionReason ?? null,
      referralCode: vendor.referralCode ?? null,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      kyc: vendor.kyc
        ? {
          aadhaarNumber: vendor.kyc.aadhaarNumber,
          aadhaarFrontImage: vendor.kyc.aadhaarFrontImage,
          aadhaarBackImage: vendor.kyc.aadhaarBackImage,
          panNumber: vendor.kyc.panNumber,
          panImage: vendor.kyc.panImage,
        }
        : null,
      bankDetail: vendor.bankDetail
        ? {
          bankAccount: vendor.bankDetail.bankAccount,
          ifsc: vendor.bankDetail.ifsc,
          upiId: vendor.bankDetail.upiId,
        }
        : null,
    };
  }

  private async getVendorOrThrow(vendorId: string) {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor || vendor.deletedAt) throw createHttpError(404, "Vendor not found.");
    return vendor;
  }

  private async getVendorOrThrowById(vendorId: string) {
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    return vendor;
  }

  async updateProfileByVendorId(vendorId: string, data: Record<string, unknown>) {
    const vendor = await this.getVendorOrThrowById(vendorId);
    return this.updateProfile(vendor.vendorCode, data);
  }

  async updateBankDetailByVendorId(vendorId: string, data: { bankAccount?: string; ifsc?: string; upiId?: string }) {
    const vendor = await this.getVendorOrThrowById(vendorId);
    if (data.bankAccount === undefined || data.ifsc === undefined) {
      throw createHttpError(400, "Bank account and IFSC are required.");
    }
    return this.updateBankDetail(vendor.vendorCode, {
      bankAccount: data.bankAccount,
      ifsc: data.ifsc,
      upiId: data.upiId,
    });
  }

  async updateKycByVendorId(vendorId: string, data: { aadhaarNumber?: string; panNumber?: string }, files: { aadhaarFront?: Buffer; aadhaarBack?: Buffer; pan?: Buffer }) {
    const vendor = await this.getVendorOrThrowById(vendorId);
    return this.updateKyc(vendor.vendorCode, data, files);
  }

  async uploadProfilePhotoByVendorId(vendorId: string, fileBuffer: Buffer) {
    const vendor = await this.getVendorOrThrowById(vendorId);
    return this.uploadProfilePhoto(vendor.vendorCode, fileBuffer);
  }

  async submitForVerificationByVendorId(vendorId: string) {
    const vendor = await this.getVendorOrThrowById(vendorId);
    return this.submitForVerification(vendor.vendorCode);
  }

  private async getVendorOrThrowByCode(vendorCode: string) {
    const vendor = await this.vendorRepo.findByVendorCode(vendorCode);

    if (!vendor) {
      throw createHttpError(404, "Vendor not found.");
    }

    return vendor;
  }

  async getProfile(vendorId: string): Promise<VendorPublicProfile> {
    const vendor = await this.getVendorOrThrow(vendorId);
    return this.toPublicProfile(vendor);
  }

  async updateProfile(vendorCode: string, data: Record<string, unknown>): Promise<VendorPublicProfile> {
    const vendor = await this.getVendorOrThrowByCode(vendorCode);
    const updated = await this.vendorRepo.updateProfile(vendor.id, data);
    return this.getProfile(updated.id);
  }

  async updateBankDetail(
    vendorCode: string,
    data: { bankAccount: string; ifsc: string; upiId?: string }
  ): Promise<VendorPublicProfile> {
    await this.getVendorOrThrowByCode(vendorCode);
    const vendor = await this.getVendorOrThrowByCode(vendorCode);
    await this.vendorRepo.upsertBankDetail(vendor.id, data);
    return this.getProfile(vendor.id);
  }

  async updateKyc(
    vendorCode: string,
    data: { aadhaarNumber?: string; panNumber?: string },
    files: {
      aadhaarFront?: Buffer;
      aadhaarBack?: Buffer;
      pan?: Buffer;
    }
  ): Promise<VendorPublicProfile> {
    const vendor = await this.getVendorOrThrowByCode(vendorCode);

    const uploads: Record<string, string> = {};
    if (files.aadhaarFront) {
      uploads.aadhaarFrontImage = await uploadVendorDocument(files.aadhaarFront, vendor.id, "aadhaar-front");
    }
    if (files.aadhaarBack) {
      uploads.aadhaarBackImage = await uploadVendorDocument(files.aadhaarBack, vendor.id, "aadhaar-back");
    }
    if (files.pan) {
      uploads.panImage = await uploadVendorDocument(files.pan, vendor.id, "pan");
    }

    await this.vendorRepo.upsertKyc(vendor.id, { ...data, ...uploads });
    return this.getProfile(vendor.id);
  }

  async uploadProfilePhoto(vendorCode: string, fileBuffer: Buffer): Promise<VendorPublicProfile> {
    const vendor = await this.getVendorOrThrowByCode(vendorCode);
    const url = await uploadVendorDocument(fileBuffer, vendor.id, "profile-photo");
    await this.vendorRepo.updateProfile(vendor.id, { profilePhoto: url });
    return this.getProfile(vendor.id);
  }

  async changePassword(vendorId: string, currentPassword: string, newPassword: string): Promise<void> {
    const vendor = await this.getVendorOrThrow(vendorId);

    const matches = await bcrypt.compare(currentPassword, vendor.password);
    if (!matches) throw createHttpError(401, "Current password is incorrect.");

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.vendorRepo.updatePassword(vendorId, hashed);

    if (vendor.email) {
      const { subject, html } = passwordChangedEmail(vendor.fullName);
      await sendMail({ to: vendor.email, subject, html }).catch(() => undefined);
    }
  }

  /** Signup -> profile creation is complete; move DRAFT -> UNDER_REVIEW for admin. */
  async submitForVerification(vendorCode: string): Promise<VendorPublicProfile> {
    const vendor = await this.getVendorOrThrowByCode(vendorCode);

    if (vendor.profileStatus !== VendorProfileStatus.DRAFT) {
      throw createHttpError(409, `Profile already submitted (status: ${vendor.profileStatus}).`);
    }
    if (!vendor.kyc || !vendor.bankDetail) {
      throw createHttpError(400, "Complete KYC and bank details before submitting for verification.");
    }

    await this.vendorRepo.submitForVerification(vendor.id);

    if (vendor.email) {
      const { subject, html } = submittedForReviewEmail(vendor.fullName);
      await sendMail({ to: vendor.email, subject, html }).catch(() => undefined);
    }

    return this.getProfile(vendor.id);
  }

  async requestAccountDeletion(vendorId: string, reason: string): Promise<void> {
    const vendor = await this.getVendorOrThrow(vendorId);
    await this.vendorRepo.requestDeletion(vendorId, reason);

    if (vendor.email) {
      const { subject, html } = deletionRequestedEmail(vendor.fullName);
      await sendMail({ to: vendor.email, subject, html }).catch(() => undefined);
    }
  }

  private async notify(vendorId: string, title: string, message: string, type: string): Promise<void> {
    await this.prisma.notification.create({ data: { vendorId, title, message, type } });
  }

  async wallet(vendorId: string) {
    const wallet = await this.vendorRepo.wallet(vendorId);
    if (!wallet) throw createHttpError(404, "Wallet not found.");
    return wallet;
  }

  async walletHistory(vendorId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([this.vendorRepo.walletHistory(vendorId, skip, limit), this.vendorRepo.walletHistoryCount(vendorId)]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async recharge(vendorId: string, amount: number) {
    if (amount <= 0) throw createHttpError(400, "Recharge amount must be greater than zero.");
    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet) throw createHttpError(404, "Wallet not found.");
      const next = wallet.balance.plus(amount);
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: next, totalRecharge: wallet.totalRecharge.plus(amount) } });
      const transaction = await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTxnType.RECHARGE, status: WalletTxnStatus.SUCCESS, amount, balanceAfter: next, note: "Demo wallet recharge" } });
      return { wallet: updated, transaction };
    });
    await this.notify(vendorId, "Wallet recharged", `${amount} coins were added to your wallet.`, "WALLET_RECHARGED");
    return result;
  }

  async walletIssue(vendorId: string, subject: string, description: string) {
    return this.prisma.vendorComplaint.create({ data: { vendorId, category: VendorComplaintCategory.WALLET, subject, description } });
  }

  async listLeads(
    vendorId: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.vendorRepo.technicianLeads(
        vendorId,
        skip,
        limit,
      ),
      this.vendorRepo.technicianLeadCount(vendorId),
    ]);

    const masked = items.map((lead) => {
      if (lead.status !== LeadStatus.NEW) {
        return lead;
      }

      return {
        ...lead,

        phone: this.maskPhone(lead.phone),

        email: null,

        address: this.maskAddress(
          lead.address,
          lead.area,
        ),

        latitude: null,
        longitude: null,
      };
    });

    return {
      items: masked,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async leadDetail(vendorId: string, leadId: string) {
    const [lead, vendor] = await Promise.all([this.vendorRepo.lead(leadId), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { branchId: true } })]);
    if (!lead) throw createHttpError(404, "Lead not found.");
    const isOpenForVendor = lead.status === LeadStatus.NEW && !lead.assignedVendorId && !!vendor?.branchId && lead.branchId === vendor.branchId;
    if (lead.assignedVendorId !== vendorId && !isOpenForVendor) throw createHttpError(404, "Lead not found.");
    if (isOpenForVendor) return { ...lead, phone: this.maskPhone(lead.phone), email: null, address: this.maskAddress(lead.address, lead.area), latitude: null, longitude: null };
    return lead;
  }

  private async assertTechnician(vendorId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (vendor.role !== VendorRole.TECHNICIAN) throw createHttpError(403, "Only technicians can perform lead operations.");
    if (vendor.profileStatus === VendorProfileStatus.BLOCKED) throw createHttpError(403, "Your technician account is blocked.");
  }

  async acceptLead(vendorId: string, leadId: string) {
    await this.assertTechnician(vendorId);
    return this.prisma.$transaction(async (tx) => {
      const [lead, vendor] = await Promise.all([
        tx.lead.findUnique({ where: { id: leadId } }),
        tx.vendor.findUnique({ where: { id: vendorId }, select: { branchId: true } }),
      ]);
      if (!lead) throw createHttpError(404, "Lead not found.");
      if (lead.status !== LeadStatus.NEW || lead.assignedVendorId) throw createHttpError(409, "This lead is no longer available.");
      if (!vendor?.branchId || lead.branchId !== vendor.branchId) throw createHttpError(403, "Lead is outside your branch.");
      const charge = lead.leadAcceptanceCharge?.toNumber() ?? DEFAULT_LEAD_CHARGE;
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet || wallet.balance.lt(charge)) throw createHttpError(402, "INSUFFICIENT_WALLET_BALANCE");
      const claimed = await tx.lead.updateMany({ where: { id: leadId, status: LeadStatus.NEW, assignedVendorId: null }, data: { assignedVendorId: vendorId, status: LeadStatus.ACCEPTED, acceptedAt: new Date(), leadAcceptanceCharge: charge } });
      if (claimed.count !== 1) throw createHttpError(409, "This lead was just purchased by another vendor.");
      const balance = wallet.balance.minus(charge);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalSpent: wallet.totalSpent.plus(charge) } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTxnType.LEAD_ACCEPT, status: WalletTxnStatus.SUCCESS, amount: charge, balanceAfter: balance, referenceId: leadId, note: "Lead purchase charge" } });
      await tx.leadAssignment.create({ data: { leadId, vendorId } });
      const updated = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      if (updated.serviceRequestId) await tx.serviceRequest.update({ where: { id: updated.serviceRequestId }, data: { assignedVendorId: vendorId, status: ServiceRequestStatus.ACCEPTED, acceptedAt: updated.acceptedAt } });
      return updated;
    }).then(async (lead) => { await this.notify(vendorId, "Lead accepted", `Lead ${lead.id} has been accepted.`, "LEAD_ACCEPTED"); return lead; });
  }

  async startWork(vendorId: string, leadId: string, input: ProofInput) {
    await this.assertTechnician(vendorId);
    if (input.latitude === undefined || input.longitude === undefined || !input.image) throw createHttpError(400, "latitude, longitude and image are required.");
    const imageUrl = await uploadVendorDocument(
      input.image,
      vendorId,
      "lead-start",
      leadId
    );
    const result = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.assignedVendorId !== vendorId || lead.status !== LeadStatus.ACCEPTED) throw createHttpError(409, "Lead is not ready to start.");
      const proof = await tx.leadVisitProof.create({ data: { leadId, vendorId, latitude: input.latitude as number, longitude: input.longitude as number, accuracy: input.accuracy, image: imageUrl, capturedAt: new Date() } });
      const updated = await tx.lead.update({ where: { id: leadId }, data: { status: LeadStatus.PENDING_START_VERIFICATION } });
      return { lead: updated, proof };
    });
    await this.notify(vendorId, "Start proof submitted", "Your start-work proof is awaiting admin verification.", "LEAD_STARTED");
    return result;
  }

  async denyLead(
    vendorId: string,
    leadId: string,
    input: ProofInput
  ) {
    await this.assertTechnician(vendorId);

    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !input.image ||
      !input.reason
    ) {
      throw createHttpError(
        400,
        "image, GPS and reason are required."
      );
    }

    const imageUrl = await uploadVendorDocument(
      input.image,
      vendorId,
      "lead-denial",
      leadId
    );

    const denyableStatuses: LeadStatus[] = [
      LeadStatus.ACCEPTED,
      LeadStatus.ONGOING,
    ];

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: {
          id: leadId,
        },
      });

      if (
        !lead ||
        lead.assignedVendorId !== vendorId ||
        !denyableStatuses.includes(lead.status)
      ) {
        throw createHttpError(
          409,
          "Lead cannot be denied in its current state."
        );
      }

      const proof = await tx.leadDenialProof.create({
        data: {
          leadId,
          vendorId,
          reason: input.reason as string,
          image: imageUrl,
          latitude: input.latitude as number,
          longitude: input.longitude as number,
          capturedAt: new Date(),
        },
      });

      const updated = await tx.lead.update({
        where: {
          id: leadId,
        },
        data: {
          status: LeadStatus.PENDING_DENIAL_VERIFICATION,
        },
      });

      return {
        lead: updated,
        proof,
      };
    });
  }

  async completeLead(vendorId: string, leadId: string) {
    await this.assertTechnician(vendorId);
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.assignedVendorId !== vendorId || lead.status !== LeadStatus.ONGOING) throw createHttpError(409, "Only an ongoing lead can be completed.");
      const amount = lead.estimatedAmount ?? new Prisma.Decimal(0);
      const qrPayload = JSON.stringify({ leadId, amount: amount.toString(), vendorId, client: lead.customerName });
      const reviewToken = randomUUID();
      const payment = await tx.payment.create({ data: { leadId, vendorId, amount, method: PaymentMethod.UPI, status: PaymentStatus.PENDING, qrPayload, reviewToken } });
      return { payment, qrPayload };
    });
  }

  async verifyPayment(paymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment || !payment.leadId || !payment.vendorId) {
        throw createHttpError(404, "Lead payment not found.");
      }

      // Already paid
      if (payment.status === PaymentStatus.PAID) {
        const commission = await tx.commission.findUnique({
          where: { leadId: payment.leadId },
        });

        const lead = await tx.lead.findUnique({
          where: { id: payment.leadId },
        });

        return { payment, lead, commission };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          transactionId: `DEMO-${payment.id}`,
        },
      });

      const lead = await tx.lead.update({
        where: { id: payment.leadId },
        data: {
          status: LeadStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      if (lead.serviceRequestId) {
        await tx.serviceRequest.update({ where: { id: lead.serviceRequestId }, data: { assignedVendorId: payment.vendorId, status: ServiceRequestStatus.COMPLETED, completedAt: lead.completedAt } });
      }

      const percentage = Number(
        process.env.VENDOR_COMMISSION_PERCENT ?? DEFAULT_COMMISSION_PERCENT
      );

      const commissionAmount = payment.amount.mul(percentage).div(100);

      const commission = await tx.commission.upsert({
        where: { leadId: lead.id },
        update: {},
        create: {
          leadId: lead.id,
          vendorId: payment.vendorId,
          amount: commissionAmount,
          percentage,
          status: CommissionStatus.PENDING,
        },
      });

      return { payment: updatedPayment, lead, commission };
    });

    if (result.commission) {
      await this.creditCommission(result.commission.id);
    }

    return result;
  }

  async creditCommission(commissionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findUnique({ where: { id: commissionId } });
      if (!commission || commission.status === CommissionStatus.CREDITED) return commission;
      const wallet = await tx.wallet.findUnique({ where: { vendorId: commission.vendorId } });
      if (!wallet) throw createHttpError(404, "Vendor wallet not found.");
      const balance = wallet.balance.plus(commission.amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalEarned: wallet.totalEarned.plus(commission.amount) } });
      const transaction = await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTxnType.COMMISSION_CREDIT, status: WalletTxnStatus.SUCCESS, amount: commission.amount, balanceAfter: balance, referenceId: commission.id, note: "Lead completion commission" } });
      const offer = await tx.offer.findFirst({ where: { isActive: true, type: OfferType.CASHBACK }, orderBy: { createdAt: "asc" } });
      if (offer) await tx.offerReward.create({ data: { offerId: offer.id, vendorId: commission.vendorId } });
      const updated = await tx.commission.update({ where: { id: commission.id }, data: { status: CommissionStatus.CREDITED, transactionId: transaction.id } });
      return updated;
    }).then(async (commission) => { if (commission) await this.notify(commission.vendorId, "Commission credited", `Commission ${commission.amount} coins credited.`, "COMMISSION_CREDITED"); return commission; });
  }

  async review(leadId: string, reviewToken: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw createHttpError(400, "Rating must be between 1 and 5.");
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.status !== LeadStatus.COMPLETED || !lead.assignedVendorId) throw createHttpError(409, "Review is only available for a completed lead.");

      // reviewToken ties this submission to the specific completion payment,
      // so only whoever received the payment QR (the client) can review —
      // not just any authenticated vendor calling the endpoint.
      const payment = await tx.payment.findFirst({ where: { leadId, reviewToken } });
      if (!payment) throw createHttpError(403, "Invalid or missing review token.");

      const review = await tx.review.create({ data: { leadId, vendorId: lead.assignedVendorId, rating, comment } });
      const lowRatings = await tx.review.count({ where: { vendorId: lead.assignedVendorId, rating: { lte: 2 } } });
      let justBlocked = false;
      if (lowRatings >= 10) {
        const vendor = await tx.vendor.findUnique({ where: { id: lead.assignedVendorId } });
        if (vendor && vendor.profileStatus !== VendorProfileStatus.BLOCKED) {
          await tx.vendor.update({ where: { id: lead.assignedVendorId }, data: { profileStatus: VendorProfileStatus.BLOCKED } });
          justBlocked = true;
        }
      }
      return { review, lowRatingCount: lowRatings, justBlocked };
    }).then(async (result) => {
      if (result.justBlocked) {
        const blockedVendor = await this.prisma.vendor.findUnique({ where: { id: result.review.vendorId } });
        if (blockedVendor) {
          await this.notify(blockedVendor.id, "Profile restricted", "Your profile was restricted due to low ratings. Contact your local admin.", "PROFILE_RESTRICTED");
          if (blockedVendor.email) {
            const contactEmail = process.env.SUPPORT_CONTACT_EMAIL || "support@rocare.com";
            const contactPhone = process.env.SUPPORT_CONTACT_PHONE || "+91-00000-00000";
            const { subject, html } = accountRestrictedEmail(blockedVendor.fullName, contactEmail, contactPhone);
            await sendMail({ to: blockedVendor.email, subject, html }).catch(() => undefined);
          }
        }
      }
      return { review: result.review, lowRatingCount: result.lowRatingCount };
    });
  }

  async notifications(vendorId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([this.vendorRepo.notifications(vendorId, (page - 1) * limit, limit), this.vendorRepo.notificationCount(vendorId)]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async markNotificationsRead(vendorId: string, all: boolean, id?: string) {
    if (all) return this.prisma.notification.updateMany({ where: { vendorId, isRead: false }, data: { isRead: true } });
    if (!id) throw createHttpError(400, "notification id is required.");
    return this.prisma.notification.updateMany({ where: { id, vendorId }, data: { isRead: true } });
  }

  async offers(vendorId: string) { return this.vendorRepo.offers(vendorId); }
  async products() { return this.vendorRepo.products(); }
  async parts() { return this.vendorRepo.parts(); }

  async purchaseProduct(vendorId: string, productId: string, quantity: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive || product.stock < quantity) throw createHttpError(409, "Product unavailable or insufficient stock.");
      const total = product.price.mul(quantity);
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet || wallet.balance.lt(total)) throw createHttpError(402, "INSUFFICIENT_WALLET_BALANCE");
      const balance = wallet.balance.minus(total);
      await tx.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalSpent: wallet.totalSpent.plus(total) } });
      return tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTxnType.PRODUCT_PURCHASE, status: WalletTxnStatus.SUCCESS, amount: total, balanceAfter: balance, referenceId: productId, note: `Product purchase x${quantity}` } });
    });
  }

  async purchasePart(vendorId: string, partId: string, quantity: number) {
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { id: partId } });
      if (!part || !part.isActive || part.stock < quantity) throw createHttpError(409, "Part unavailable or insufficient stock.");
      const total = part.price.mul(quantity);
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet || wallet.balance.lt(total)) throw createHttpError(402, "INSUFFICIENT_WALLET_BALANCE");
      const balance = wallet.balance.minus(total);
      await tx.part.update({ where: { id: partId }, data: { stock: { decrement: quantity } } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalSpent: wallet.totalSpent.plus(total) } });
      return tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTxnType.PART_PURCHASE, status: WalletTxnStatus.SUCCESS, amount: total, balanceAfter: balance, referenceId: partId, note: `Part purchase x${quantity}` } });
    });
  }

  async complaints(vendorId: string) { return this.vendorRepo.complaints(vendorId); }
  async createComplaint(vendorId: string, category: string, subject: string, description: string) { return this.prisma.vendorComplaint.create({ data: { vendorId, category: category as VendorComplaintCategory, subject, description } }); }
}
