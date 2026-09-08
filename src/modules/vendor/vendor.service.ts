import { injectable, inject } from "tsyringe";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { VendorRepository } from "./vendor.repository";
import { uploadVendorDocument } from "../../utils/uploadVendorDocument";
import razorpay from "../../config/razorpay";
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

import { MlmService } from "../mlm/mlm.service";

const SALT_ROUNDS = 10;
export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_LEAD_CHARGE = 10;

@injectable()
export class VendorService {
  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient,
    @inject(VendorRepository) private readonly vendorRepo: VendorRepository,
    @inject(MlmService) private readonly mlmService: MlmService
  ) { }

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
      specializations: vendor.specializations ?? [],
      verificationStatus: vendor.verificationStatus,
      profileStatus: vendor.profileStatus,
      rejectionReason: vendor.rejectionReason ?? null,
      referralCode: vendor.referralCode ?? null,
      rank: vendor.rank ?? "BRONZE",
      rankProgress: this.mlmService.getRankProgress(
        vendor.bv ? Number(vendor.bv) : 0
      ),
      pv: vendor.pv ? Number(vendor.pv) : 0,
      bv: vendor.bv ? Number(vendor.bv) : 0,
      totalEarnings: vendor.totalEarnings ? Number(vendor.totalEarnings) : 0,
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

    // Whitelist only safe editable profile fields
    const safeUpdateData: Record<string, unknown> = {};

    if (data.fullName !== undefined) safeUpdateData.fullName = data.fullName;
    if (data.email !== undefined) safeUpdateData.email = data.email;
    if (data.phone !== undefined) safeUpdateData.phone = data.phone;
    if (data.profilePhoto !== undefined) safeUpdateData.profilePhoto = data.profilePhoto;
    if (data.address !== undefined) safeUpdateData.address = data.address;
    if (data.city !== undefined) safeUpdateData.city = data.city;
    if (data.district !== undefined) safeUpdateData.district = data.district;
    if (data.state !== undefined) safeUpdateData.state = data.state;
    if (data.pincode !== undefined) safeUpdateData.pincode = data.pincode;
    if (data.latitude !== undefined) safeUpdateData.latitude = data.latitude;
    if (data.longitude !== undefined) safeUpdateData.longitude = data.longitude;
    if (data.experienceYears !== undefined) safeUpdateData.experienceYears = data.experienceYears;
    if (data.skills !== undefined) safeUpdateData.skills = data.skills;
    if (data.specializations !== undefined) {
      const list = Array.isArray(data.specializations)
        ? data.specializations.map((s: string) => s.trim()).filter(Boolean)
        : [];
      safeUpdateData.specializations = list;
      // Keep the legacy single-value column in sync for any code that still reads it.
      safeUpdateData.specialization = list[0] ?? null;
    } else if (data.specialization !== undefined) {
      safeUpdateData.specialization = data.specialization;
    }

    // Explicitly guarantee verificationStatus and profileStatus are NEVER overwritten or downgraded by profile updates
    delete (safeUpdateData as any).verificationStatus;
    delete (safeUpdateData as any).profileStatus;
    delete (safeUpdateData as any).role;
    delete (safeUpdateData as any).password;
    delete (safeUpdateData as any).vendorCode;
    delete (safeUpdateData as any).id;

    const updated = await this.vendorRepo.updateProfile(vendor.id, safeUpdateData);
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

    // Alert Admins of new KYC submission
    await this.prisma.user
      .findMany({
        where: {
          role: { in: ["ADMIN", "SADMIN"] as any },
          isActive: true,
          deletedAt: null,
          ...(vendor.branchId ? { adminProfile: { branchId: vendor.branchId } } : {}),
        },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Vendor KYC Submitted 📄",
              message: `Technician ${vendor.fullName} (${vendor.vendorCode}) submitted documents for verification.`,
              type: "VENDOR_KYC_SUBMITTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins KYC Error]", err));

    return this.getProfile(vendor.id);
  }

  async requestAccountDeletion(vendorId: string, reason: string): Promise<void> {
    const vendor = await this.getVendorOrThrow(vendorId);
    await this.vendorRepo.requestDeletion(vendorId, reason);

    if (vendor.email) {
      const { subject, html } = deletionRequestedEmail(vendor.fullName);
      await sendMail({ to: vendor.email, subject, html }).catch(() => undefined);
    }

    // Alert Super Admins
    await this.prisma.user
      .findMany({
        where: { role: "SADMIN" as any, isActive: true, deletedAt: null },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Account Deletion Requested ⚠️",
              message: `Technician ${vendor.fullName} requested account deletion. Reason: ${reason}`,
              type: "VENDOR_DELETION_REQUESTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins Deletion Error]", err));
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

  /**
   * Step 1 of a real recharge: create a Razorpay order and a matching PENDING
   * WalletTransaction. The wallet is NOT credited yet — that only happens once
   * verifyRecharge() confirms Razorpay's payment signature.
   */
  async createRechargeOrder(vendorId: string, amount: number) {
    if (amount <= 0) throw createHttpError(400, "Recharge amount must be greater than zero.");

    const wallet = await this.prisma.wallet.findUnique({ where: { vendorId } });
    if (!wallet) throw createHttpError(404, "Wallet not found.");

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      // Razorpay caps `receipt` at 56 chars — keep it short, the full vendorId lives in `notes`.
      receipt: `wr_${Date.now()}_${vendorId.slice(0, 8)}`,
      notes: { vendorId, purpose: "WALLET_RECHARGE" },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxnType.RECHARGE,
        status: WalletTxnStatus.PENDING,
        amount,
        referenceId: order.id,
        note: "Recharge initiated — awaiting payment confirmation.",
      },
    });

    return {
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "",
    };
  }

  /**
   * Step 2: verify Razorpay's payment signature server-side, then — and only
   * then — credit the wallet. Idempotent: replaying the same verified payment
   * returns the already-credited state instead of double-crediting.
   */
  async verifyRecharge(
    vendorId: string,
    data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  ) {
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const expectedSignature = createHmac("sha256", secret)
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(data.razorpaySignature, "hex");
    const signatureValid =
      expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

    if (!signatureValid) {
      throw createHttpError(400, "Payment verification failed. Signature mismatch.");
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { vendorId } });
    if (!wallet) throw createHttpError(404, "Wallet not found.");

    const pendingTxn = await this.prisma.walletTransaction.findFirst({
      where: { walletId: wallet.id, referenceId: data.razorpayOrderId, type: WalletTxnType.RECHARGE },
    });
    if (!pendingTxn) throw createHttpError(404, "Recharge order not found for this vendor.");

    if (pendingTxn.status === WalletTxnStatus.SUCCESS) {
      // Already credited (e.g. the verify call was retried) — return as-is, don't double-credit.
      return { wallet, transaction: pendingTxn };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const freshWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const next = freshWallet.balance.plus(pendingTxn.amount);
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: next, totalRecharge: freshWallet.totalRecharge.plus(pendingTxn.amount) },
      });
      const transaction = await tx.walletTransaction.update({
        where: { id: pendingTxn.id },
        data: {
          status: WalletTxnStatus.SUCCESS,
          balanceAfter: next,
          // referenceId stays the order id (stable lookup key for the idempotency
          // check above) — it's still there for support/reconciliation lookups in
          // Razorpay's dashboard, just not surfaced in this user-facing note.
          note: "Wallet recharged via Razorpay",
        },
      });
      return { wallet: updatedWallet, transaction };
    });

    await this.notify(
      vendorId,
      "Wallet recharged",
      `${pendingTxn.amount} coins were added to your wallet.`,
      "WALLET_RECHARGED"
    );
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

  async createLead(vendorId: string, data: any) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw createHttpError(404, "Vendor not found.");

    const lead = await this.prisma.lead.create({
      data: {
        customerName: data.customerName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        district: data.district || vendor.district,
        pincode: data.pincode || vendor.pincode,
        specialization: data.specialization || vendor.specializations[0] || vendor.specialization,
        serviceType: data.serviceType,
        issue: data.issue,
        estimatedAmount: data.estimatedAmount,
        isReleased: false,
        leadCreatedByType: "VENDOR",
        branchId: vendor.branchId,
        source: "ALL",
        status: LeadStatus.NEW,
      },
    });

    await this.notify(
      vendorId,
      "Lead Submitted",
      "Your lead has been submitted to admin for pricing and release.",
      "LEAD_SUBMITTED"
    );
    return lead;
  }

  async acceptLead(vendorId: string, leadId: string) {
    await this.assertTechnician(vendorId);
    return this.prisma.$transaction(async (tx) => {
      const [lead, vendor] = await Promise.all([
        tx.lead.findUnique({ where: { id: leadId } }),
        tx.vendor.findUnique({ where: { id: vendorId }, select: { branchId: true, specializations: true } }),
      ]);
      if (!lead) throw createHttpError(404, "Lead not found.");
      if (lead.status !== LeadStatus.NEW || lead.assignedVendorId) {
        throw createHttpError(409, "This lead is no longer available.");
      }
      if (!lead.isReleased) {
        throw createHttpError(409, "This lead has not been released by the admin yet.");
      }
      if (
        vendor?.specializations &&
        vendor.specializations.length > 0 &&
        lead.specialization &&
        !vendor.specializations.includes(lead.specialization)
      ) {
        throw createHttpError(403, `This lead requires ${lead.specialization} specialization.`);
      }

      const charge = lead.leadAcceptPrice?.toNumber() ?? lead.leadAcceptanceCharge?.toNumber() ?? DEFAULT_LEAD_CHARGE;
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet || wallet.balance.lt(charge)) throw createHttpError(402, "INSUFFICIENT_WALLET_BALANCE");

      const claimed = await tx.lead.updateMany({
        where: { id: leadId, status: LeadStatus.NEW, assignedVendorId: null },
        data: {
          assignedVendorId: vendorId,
          status: LeadStatus.ACCEPTED,
          acceptedAt: new Date(),
          leadAcceptanceCharge: charge,
        },
      });
      if (claimed.count !== 1) throw createHttpError(409, "This lead was just purchased by another vendor.");

      const balance = wallet.balance.minus(charge);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalSpent: wallet.totalSpent.plus(charge) } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.LEAD_ACCEPT,
          status: WalletTxnStatus.SUCCESS,
          amount: charge,
          balanceAfter: balance,
          referenceId: leadId,
          note: `Lead purchase charge for ${lead.specialization || "service"}`,
        },
      });
      await tx.leadAssignment.create({ data: { leadId, vendorId } });
      const updated = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      if (updated.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updated.serviceRequestId },
          data: { assignedVendorId: vendorId, status: ServiceRequestStatus.ACCEPTED, acceptedAt: updated.acceptedAt },
        });
      }
      return updated;
    }).then(async (lead) => {
      await this.notify(vendorId, "Lead accepted", `Lead ${lead.id} has been accepted.`, "LEAD_ACCEPTED");
      return lead;
    });
  }

  async startWork(vendorId: string, leadId: string, input: ProofInput) {
    await this.assertTechnician(vendorId);
    // Geo-tagged photo + GPS are encouraged but not mandatory — a vendor can
    // still submit a plain photo, or none at all, and proceed to the job.
    const imageUrl = input.image ? await uploadVendorDocument(input.image, vendorId, "lead-start", leadId) : null;
    const result = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.assignedVendorId !== vendorId || lead.status !== LeadStatus.ACCEPTED) throw createHttpError(409, "Lead is not ready to start.");
      // Auto-approved on submission — no separate admin review step blocking
      // the vendor from proceeding to the job. The proof is still recorded
      // for audit purposes (verified=true reflects the automatic approval).
      const proof = await tx.leadVisitProof.create({
        data: {
          leadId,
          vendorId,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          accuracy: input.accuracy,
          image: imageUrl,
          capturedAt: new Date(),
          verified: true,
          verifiedAt: new Date(),
        },
      });
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.ONGOING, startVerifiedAt: new Date() },
      });
      if (updated.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updated.serviceRequestId },
          data: { status: ServiceRequestStatus.ONGOING },
        });
      }
      return { lead: updated, proof };
    });

    await this.notify(vendorId, "Job started", "You've started this job — mark it complete once the work is done.", "LEAD_STARTED");

    // FYI to branch admins — informational only, no action needed since this
    // is auto-approved.
    await this.prisma.user
      .findMany({
        where: {
          role: { in: ["ADMIN", "SADMIN"] as any },
          isActive: true,
          deletedAt: null,
          ...(result.lead.branchId ? { adminProfile: { branchId: result.lead.branchId } } : {}),
        },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Technician Started Job 📸",
              message: `Technician started work on lead #${result.lead.id.slice(0, 8)}.`,
              type: "START_PROOF_SUBMITTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins Start Proof Error]", err));

    return result;
  }

  async denyLead(
    vendorId: string,
    leadId: string,
    input: ProofInput
  ) {
    await this.assertTechnician(vendorId);

    if (!input.reason) {
      throw createHttpError(400, "A reason is required to deny this lead.");
    }

    // Geo-tagged photo + GPS are encouraged but not mandatory.
    const imageUrl = input.image ? await uploadVendorDocument(input.image, vendorId, "lead-denial", leadId) : null;

    const denyableStatuses: LeadStatus[] = [
      LeadStatus.ACCEPTED,
      LeadStatus.ONGOING,
      LeadStatus.PENDING_START_VERIFICATION,
    ];

    const result = await this.prisma.$transaction(async (tx) => {
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
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
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

    // Alert Branch Admins
    await this.prisma.user
      .findMany({
        where: {
          role: { in: ["ADMIN", "SADMIN"] as any },
          isActive: true,
          deletedAt: null,
          ...(result.lead.branchId ? { adminProfile: { branchId: result.lead.branchId } } : {}),
        },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Denial Proof Submitted 🛑",
              message: `Technician submitted denial proof on lead #${result.lead.id.slice(0, 8)}. Reason: ${input.reason}`,
              type: "DENIAL_PROOF_SUBMITTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins Denial Proof Error]", err));

    return result;
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

  /**
   * Completion path 1: vendor collected cash in hand from the customer.
   * The cash is already with the vendor — it does NOT get credited to their
   * in-app wallet. It's just recorded (method: CASH, PAID) so admins can see
   * and reconcile it.
   */
  async completeLeadCash(vendorId: string, leadId: string, amount: number) {
    await this.assertTechnician(vendorId);
    if (amount <= 0) throw createHttpError(400, "Amount must be greater than zero.");

    const result = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead || lead.assignedVendorId !== vendorId || lead.status !== LeadStatus.ONGOING) {
        throw createHttpError(409, "Only an ongoing lead can be completed.");
      }
      const payment = await tx.payment.create({
        data: {
          leadId,
          vendorId,
          amount,
          method: PaymentMethod.CASH,
          status: PaymentStatus.PAID,
          transactionId: `CASH-${randomUUID()}`,
          reviewToken: randomUUID(),
        },
      });
      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.COMPLETED, completedAt: new Date() },
      });
      if (updatedLead.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updatedLead.serviceRequestId },
          data: { assignedVendorId: vendorId, status: ServiceRequestStatus.COMPLETED, completedAt: updatedLead.completedAt },
        });
      }
      return { payment, lead: updatedLead };
    });

    await this.prisma.user
      .findMany({
        where: {
          role: { in: ["ADMIN", "SADMIN"] as any },
          isActive: true,
          deletedAt: null,
          ...(result.lead.branchId ? { adminProfile: { branchId: result.lead.branchId } } : {}),
        },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Cash Payment Collected 💵",
              message: `Vendor collected ₹${amount} cash for lead #${result.lead.id.slice(0, 8)}. Not credited to vendor wallet.`,
              type: "CASH_PAYMENT_COLLECTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins Cash Payment Error]", err));

    return result;
  }

  /**
   * Completion path 2, step 1: create a real Razorpay order for the lead's
   * agreed price so the customer can pay online.
   */
  async createLeadRazorpayOrder(vendorId: string, leadId: string) {
    await this.assertTechnician(vendorId);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.assignedVendorId !== vendorId || lead.status !== LeadStatus.ONGOING) {
      throw createHttpError(409, "Only an ongoing lead can be completed.");
    }
    const amount = Number(lead.estimatedAmount ?? lead.leadPrice ?? 0);
    if (amount <= 0) throw createHttpError(400, "This lead has no service amount set.");

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      // Razorpay caps `receipt` at 56 chars.
      receipt: `lead_${Date.now()}_${leadId.slice(0, 8)}`,
      notes: { leadId, vendorId, purpose: "LEAD_COMPLETION_PAYMENT" },
    });

    await this.prisma.payment.create({
      data: {
        leadId,
        vendorId,
        amount,
        method: PaymentMethod.RAZORPAY,
        status: PaymentStatus.PENDING,
        qrPayload: order.id, // stash the Razorpay order id for the verify lookup below
        reviewToken: randomUUID(),
      },
    });

    return { orderId: order.id, amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID || "" };
  }

  /**
   * Completion path 2, step 2: verify Razorpay's signature server-side, mark
   * the lead complete, and credit the vendor's commission — same commission
   * math as the legacy verifyPayment() flow, just driven by a real payment.
   */
  async verifyLeadRazorpayPayment(
    vendorId: string,
    leadId: string,
    data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  ) {
    await this.assertTechnician(vendorId);

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const expectedSignature = createHmac("sha256", secret)
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(data.razorpaySignature, "hex");
    const signatureValid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!signatureValid) throw createHttpError(400, "Payment verification failed. Signature mismatch.");

    const pendingPayment = await this.prisma.payment.findFirst({
      where: { leadId, vendorId, qrPayload: data.razorpayOrderId, method: PaymentMethod.RAZORPAY },
    });
    if (!pendingPayment) throw createHttpError(404, "Payment order not found for this lead.");

    if (pendingPayment.status === PaymentStatus.PAID) {
      // Already processed (e.g. verify was retried) — return current state, don't double-process.
      const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
      const commission = await this.prisma.commission.findUnique({ where: { leadId } });
      return { payment: pendingPayment, lead, commission };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: pendingPayment.id },
        data: { status: PaymentStatus.PAID, transactionId: data.razorpayPaymentId },
      });
      const lead = await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.COMPLETED, completedAt: new Date() },
      });
      if (lead.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: lead.serviceRequestId },
          data: { assignedVendorId: vendorId, status: ServiceRequestStatus.COMPLETED, completedAt: lead.completedAt },
        });
      }

      const percentage = Number(process.env.VENDOR_COMMISSION_PERCENT ?? DEFAULT_COMMISSION_PERCENT);
      const commissionAmount = updatedPayment.amount.mul(percentage).div(100);
      const commission = await tx.commission.upsert({
        where: { leadId },
        update: {},
        create: { leadId, vendorId, amount: commissionAmount, percentage, status: CommissionStatus.PENDING },
      });

      return { payment: updatedPayment, lead, commission };
    });

    if (result.commission) await this.creditCommission(result.commission.id);
    return result;
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
            const contactEmail = process.env.SUPPORT_CONTACT_EMAIL || "support@just24you.com";
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
