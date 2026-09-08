import { injectable, inject } from "tsyringe";
import type { Prisma } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { AdminRepository } from "./admin.repository";
import {
  OrderStatus,
  PaymentStatus,
  Role,
  VendorComplaintStatus,
  VendorProfileStatus,
  VendorVerificationStatus,
  WalletTxnType,
  LeadStatus,
  VendorRole,
} from "../../generated/prisma/enums";
import { sendMail } from "../../utils/mailer";
import { adminWelcomeEmail } from "../../utils/vendorMailTemplates";
import { generateRandomPassword } from "../../utils/passwordGenerator";
import {
  uploadProductImage,
  uploadPartImage,
  uploadMultipleImages,
} from "../../utils/uploadProductImage";
import {
  CreateVendorDto,
  AdminCreateLeadDto,
  PriceAndReleaseLeadDto,
  AdminUpdateLeadDto,
  LeadQueryDto,
  AdminNotificationQueryDto,
  AdminBroadcastNotificationDto,
  AdminCategoryDto,
  AdminCategoryQueryDto,
} from "./admin.dto";
import { randomInt } from "crypto";

const SALT_ROUNDS = 10;
const DEFAULT_COMMISSION_PERCENT = 10;

function parseBoolean(val: any): boolean | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === true || val === "true" || val === 1 || val === "1") return true;
  if (val === false || val === "false" || val === 0 || val === "0") return false;
  return Boolean(val);
}

function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}

function parseArray(val: any): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }
  return [String(val)];
}

function parseJson(val: any): Record<string, any> | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cleanProductInput(input: any): any {
  if (!input || typeof input !== "object") return {};
  const result: any = {};

  if (input.name !== undefined) result.name = String(input.name);
  if (input.category !== undefined) result.category = input.category || null;
  if (input.categoryId !== undefined) result.categoryId = input.categoryId || null;
  if (input.brand !== undefined) result.brand = input.brand ? String(input.brand) : null;
  if (input.description !== undefined) result.description = input.description ? String(input.description) : null;
  if (input.mrp !== undefined) result.mrp = parseNumber(input.mrp);
  if (input.price !== undefined) result.price = parseNumber(input.price);
  if (input.discountPercent !== undefined) result.discountPercent = parseNumber(input.discountPercent);
  if (input.vendorWholesalePrice !== undefined) result.vendorWholesalePrice = parseNumber(input.vendorWholesalePrice);
  if (input.bulkMinQty !== undefined) result.bulkMinQty = parseNumber(input.bulkMinQty) ?? 1;
  if (input.bulkDiscountPercent !== undefined) result.bulkDiscountPercent = parseNumber(input.bulkDiscountPercent);
  if (input.referralDiscountPercent !== undefined) result.referralDiscountPercent = parseNumber(input.referralDiscountPercent);
  if (input.isPartOnlyForVendor !== undefined) result.isPartOnlyForVendor = parseBoolean(input.isPartOnlyForVendor) ?? false;
  if (input.bulkQtyDiscount !== undefined) result.bulkQtyDiscount = parseBoolean(input.bulkQtyDiscount) ?? false;
  if (input.pv !== undefined) result.pv = parseNumber(input.pv) ?? 0;
  if (input.bv !== undefined) result.bv = parseNumber(input.bv) ?? 0;

  const stockVal = input.stock ?? input.stockQuantity ?? input.quantity;
  if (stockVal !== undefined) result.stock = parseNumber(stockVal) ?? 0;

  if (input.images !== undefined) result.images = parseArray(input.images) ?? [];
  if (input.features !== undefined) result.features = parseArray(input.features);
  if (input.specifications !== undefined) result.specifications = parseJson(input.specifications);
  if (input.isActive !== undefined) result.isActive = parseBoolean(input.isActive) ?? true;
  if (input.branchId !== undefined) result.branchId = input.branchId || null;

  return result;
}

function cleanPartInput(input: any): any {
  if (!input || typeof input !== "object") return {};
  const result: any = {};

  if (input.name !== undefined) result.name = String(input.name);
  if (input.description !== undefined) result.description = input.description ? String(input.description) : null;
  if (input.price !== undefined) result.price = parseNumber(input.price);

  const stockVal = input.stock ?? input.stockQuantity ?? input.quantity;
  if (stockVal !== undefined) result.stock = parseNumber(stockVal) ?? 0;

  if (input.images !== undefined) result.images = parseArray(input.images) ?? [];
  if (input.isActive !== undefined) result.isActive = parseBoolean(input.isActive) ?? true;

  return result;
}

@injectable()
export class AdminService {
  constructor(@inject(AdminRepository) private readonly repo: AdminRepository) {}

  async context(userId: string) {
    const user = await this.repo.findUser(userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw createHttpError(403, "Admin account is inactive.");
    }
    if (user.role !== Role.ADMIN && user.role !== Role.SADMIN) {
      throw createHttpError(403, "Admin access required.");
    }
    if (user.role === Role.ADMIN && !user.adminProfile?.branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }
    return user;
  }

  /** SADMIN is always global. ADMIN is always locked to its assigned branch. */
  private branchFilter(role: Role, branchId: string | null | undefined) {
    if (role === Role.SADMIN) return {};
    if (!branchId) throw createHttpError(403, "Admin branch is not configured.");
    return { branchId };
  }

  /**
   * Admin / Super Admin creates a Vendor directly
   */
  async createVendor(userId: string, data: CreateVendorDto) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;

    const existingPhone = await this.repo.findVendorByPhone(data.phone);
    if (existingPhone && !existingPhone.deletedAt) {
      throw createHttpError(409, "A vendor with this phone number already exists.");
    }

    if (data.email) {
      const existingEmail = await this.repo.findVendorByEmail(data.email);
      if (existingEmail && !existingEmail.deletedAt) {
        throw createHttpError(409, "A vendor with this email already exists.");
      }
    }

    const vendorCode = `VND-${randomInt(10000, 99999)}`;
    const plainPassword = data.password ?? generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

    const vendor = await this.repo.createVendor({
      vendorCode,
      role: data.role,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      address: data.address,
      city: data.city,
      district: data.district,
      state: data.state,
      pincode: data.pincode,
      specializations: data.specializations ?? (data.specialization ? [data.specialization] : []),
      // Keep the legacy single-value column in sync for any code that still reads it.
      specialization: data.specializations?.[0] ?? data.specialization,
      experienceYears: data.experienceYears,
      skills: data.skills || [],
      branchId: branchId || undefined,
      verificationStatus: data.verificationStatus || VendorVerificationStatus.VERIFIED,
      profileStatus: data.profileStatus || VendorProfileStatus.PUBLISHED,
    });

    await this.audit(userId, "VENDOR_CREATED_BY_ADMIN", "Vendor", vendor.id, {
      vendorCode,
      role: data.role,
      specializations: data.specializations ?? (data.specialization ? [data.specialization] : []),
      branchId,
    });

    if (data.email) {
      const { subject, html } = adminWelcomeEmail(
        data.fullName,
        data.email,
        plainPassword,
        vendor.branch?.name
      );
      await sendMail({ to: data.email, subject, html }).catch(() => undefined);
    }

    return {
      ...vendor,
      temporaryPassword: data.password ? undefined : plainPassword,
    };
  }

  async vendors(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const where = { deletedAt: null, ...this.branchFilter(user.role, user.adminProfile?.branchId) };
    const [data, total] = await Promise.all([
      this.repo.listVendors(where, (page - 1) * limit, limit),
      this.repo.countVendors(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async verifyVendor(userId: string, vendorId: string, approved: boolean, reason?: string) {
    const user = await this.context(userId);
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Vendor is outside your branch.");
    }
    return this.repo.updateVendor(vendorId, {
      verificationStatus: approved
        ? VendorVerificationStatus.VERIFIED
        : VendorVerificationStatus.REJECTED,
      rejectionReason: approved ? null : reason ?? "Rejected by admin.",
    });
  }

  async publishVendor(userId: string, vendorId: string) {
    const user = await this.context(userId);
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Vendor is outside your branch.");
    }
    if (vendor.verificationStatus !== VendorVerificationStatus.VERIFIED) {
      throw createHttpError(409, "Vendor must be verified before publishing.");
    }
    return this.repo.updateVendor(vendorId, { profileStatus: VendorProfileStatus.PUBLISHED });
  }

  async unblockVendor(userId: string, vendorId: string) {
    const user = await this.context(userId);
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Vendor is outside your branch.");
    }
    return this.repo.updateVendor(vendorId, { profileStatus: VendorProfileStatus.PUBLISHED });
  }

  async assignVendorBranch(userId: string, vendorId: string, branchId: string) {
    await this.context(userId);
    const user = await this.requireSuperAdmin(userId);
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    const branch = await this.repo.findBranch(branchId);
    if (!branch || !branch.isActive) {
      throw createHttpError(400, "The selected branch is invalid or inactive.");
    }
    const updated = await this.repo.updateVendor(vendorId, { branchId });
    await this.audit(user.id, "VENDOR_BRANCH_CHANGED", "Vendor", vendorId, { branchId });
    return updated;
  }

  /**
   * Admin create lead
   */
  async createLead(userId: string, data: AdminCreateLeadDto) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;

    // Direct-assign leads go straight to one vendor and skip the open pool.
    // Everything else already carries price + coins + location + specialization
    // from this same form, so there's no reason to make the admin release it
    // separately — release it immediately so matching vendors see it right away.
    const shouldRelease = data.isReleased ?? !data.assignedVendorId;

    const lead = await this.repo.createLead({
      customerName: data.customerName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      district: data.district,
      pincode: data.pincode,
      specialization: data.specialization,
      serviceType: data.serviceType,
      issue: data.issue,
      estimatedAmount: data.estimatedAmount,
      leadPrice: data.leadPrice,
      leadAcceptPrice: data.leadAcceptPrice ?? data.leadAcceptanceCharge,
      leadAcceptanceCharge: data.leadAcceptanceCharge ?? data.leadAcceptPrice,
      assignedVendorId: data.assignedVendorId || undefined,
      isReleased: shouldRelease,
      releasedAt: shouldRelease ? new Date() : null,
      leadCreatedByType: "ADMIN",
      branchId: branchId || undefined,
      serviceId: data.serviceId,
      productId: data.productId,
      createdById: userId,
    });

    if (lead.isReleased) {
      await this.notifyMatchingVendors(lead);
    }

    return lead;
  }

  /**
   * Admin sets lead price & accept price, and releases to local matching vendors
   */
  async priceAndReleaseLead(userId: string, leadId: string, data: PriceAndReleaseLeadDto) {
    const user = await this.context(userId);
    const lead = await this.repo.findLead(leadId);
    if (!lead) throw createHttpError(404, "Lead not found.");

    if (user.role === Role.ADMIN && lead.branchId && lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch scope.");
    }

    const updated = await this.repo.updateLead(leadId, {
      leadPrice: data.leadPrice,
      leadAcceptPrice: data.leadAcceptPrice,
      leadAcceptanceCharge: data.leadAcceptPrice,
      district: data.district || lead.district,
      pincode: data.pincode || lead.pincode,
      specialization: data.specialization || lead.specialization,
      branchId: data.branchId || lead.branchId,
      isReleased: true,
      releasedAt: new Date(),
    });

    await this.notifyMatchingVendors(updated);
    await this.audit(userId, "LEAD_PRICED_AND_RELEASED", "Lead", leadId, {
      leadPrice: data.leadPrice,
      leadAcceptPrice: data.leadAcceptPrice,
      district: data.district,
      pincode: data.pincode,
      specialization: data.specialization,
      branchId: data.branchId,
    });

    return updated;
  }

  async getLead(userId: string, leadId: string) {
    const user = await this.context(userId);
    const lead = await this.repo.findLead(leadId);
    if (!lead) throw createHttpError(404, "Lead not found.");
    if (user.role === Role.ADMIN && lead.branchId && lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch scope.");
    }
    return lead;
  }

  async updateLead(userId: string, leadId: string, data: AdminUpdateLeadDto) {
    const user = await this.context(userId);
    const lead = await this.repo.findLead(leadId);
    if (!lead) throw createHttpError(404, "Lead not found.");
    if (user.role === Role.ADMIN && lead.branchId && lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch scope.");
    }

    const updatePayload: any = { ...data };
    if (data.leadAcceptPrice !== undefined) {
      updatePayload.leadAcceptanceCharge = data.leadAcceptPrice;
    }
    if (data.isReleased && !lead.isReleased) {
      updatePayload.releasedAt = new Date();
    }

    const updated = await this.repo.updateLead(leadId, updatePayload);

    if (data.isReleased && !lead.isReleased) {
      await this.notifyMatchingVendors(updated);
    }

    await this.audit(userId, "LEAD_UPDATED", "Lead", leadId, data as unknown as Record<string, unknown>);
    return updated;
  }

  /**
   * Push notification to all local technicians matching lead specialization and district/pincode
   */
  private async notifyMatchingVendors(lead: any) {
    try {
      const matchingVendors = await this.repo.findMatchingTechnicians({
        specialization: lead.specialization,
        district: lead.district,
        pincode: lead.pincode,
        branchId: lead.branchId,
      });

      for (const v of matchingVendors) {
        await this.repo.notifyVendor(
          v.id,
          "New Lead Available! 🛠️",
          `New ${lead.specialization || "appliance"} service lead in ${lead.district || lead.pincode || "your area"}. Unlock now for ₹${lead.leadAcceptPrice || lead.leadAcceptanceCharge || 0}!`,
          "NEW_LEAD_RELEASED"
        );
      }
    } catch (err) {
      console.error("[Notify Matching Vendors Error]", err);
    }
  }

  async leads(userId: string, query: LeadQueryDto) {
    const user = await this.context(userId);
    const {
      page = 1,
      limit = 20,
      isReleased,
      district,
      pincode,
      specialization,
      status,
      branchId,
    } = query;

    const where: any = user.role === Role.SADMIN
      ? (branchId ? { branchId } : {})
      : this.branchFilter(user.role, user.adminProfile?.branchId);

    if (isReleased !== undefined) where.isReleased = isReleased;
    if (district) where.district = { contains: district, mode: "insensitive" };
    if (pincode) where.pincode = pincode;
    if (specialization) where.specialization = specialization;
    if (status) where.status = status as LeadStatus;

    const [data, total] = await Promise.all([
      this.repo.listLeads(where, (page - 1) * limit, limit),
      this.repo.countLeads(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async pendingStartProofs(userId: string) {
    const user = await this.context(userId);
    return this.repo.pendingStartProofs(
      user.role === Role.ADMIN ? (user.adminProfile?.branchId ?? undefined) : undefined
    );
  }

  async pendingDenialProofs(userId: string) {
    const user = await this.context(userId);
    return this.repo.pendingDenialProofs(
      user.role === Role.ADMIN ? (user.adminProfile?.branchId ?? undefined) : undefined
    );
  }

  async pendingVendors(userId: string) {
    const user = await this.context(userId);
    const where = user.role === Role.ADMIN ? { branchId: user.adminProfile?.branchId } : {};
    return this.repo.pendingVendors(where);
  }

  async blockedTechnicians(userId: string) {
    const user = await this.context(userId);
    const where = user.role === Role.ADMIN ? { branchId: user.adminProfile?.branchId } : {};
    return this.repo.blockedTechnicians(where);
  }

  async reviewStartProof(userId: string, proofId: string, approved: boolean) {
    const user = await this.context(userId);
    const proof = await this.repo.findStartProof(proofId);
    if (!proof) throw createHttpError(404, "Start proof not found.");
    if (user.role === Role.ADMIN && proof.lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch.");
    }
    return this.repo.reviewStartProof(proofId, approved);
  }

  async reviewDenialProof(
    userId: string,
    proofId: string,
    approved: boolean,
    opts?: { refundAmount?: number; reason?: string; note?: string }
  ) {
    const user = await this.context(userId);
    const proof = await this.repo.findDenialProof(proofId);
    if (!proof) throw createHttpError(404, "Denial proof not found.");
    if (user.role === Role.ADMIN && proof.lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch.");
    }
    const result = await this.repo.reviewDenialProof(proofId, approved, opts);
    await this.audit(userId, "LEAD_DENIAL_REVIEWED", "LeadDenialProof", proofId, {
      approved,
      leadId: proof.leadId,
      ...opts,
    });
    return result;
  }

  async refundLead(
    userId: string,
    leadId: string,
    opts?: { amount?: number; note?: string }
  ) {
    const user = await this.context(userId);
    const lead = await this.repo.findLead(leadId);
    if (!lead) throw createHttpError(404, "Lead not found.");
    if (user.role === Role.ADMIN && lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch.");
    }
    const result = await this.repo.refundLead(leadId, opts);
    await this.audit(userId, "LEAD_COINS_REFUNDED", "Lead", leadId, {
      vendorId: lead.assignedVendorId,
      ...opts,
    });
    return result;
  }

  async walletCredit(userId: string, vendorId: string, amount: number, note?: string) {
    return this.adjustVendorWallet(userId, vendorId, amount, WalletTxnType.ADMIN_CREDIT, note);
  }

  async walletDebit(userId: string, vendorId: string, amount: number, note?: string) {
    return this.adjustVendorWallet(userId, vendorId, -amount, WalletTxnType.ADMIN_DEBIT, note);
  }

  async walletUpdate(userId: string, vendorId: string, amount: number, note?: string) {
    const user = await this.context(userId);
    await this.assertVendorScope(user, vendorId);
    if (amount < 0) throw createHttpError(400, "Wallet balance cannot be negative.");
    return this.repo.setWalletBalance(vendorId, amount, note);
  }

  async walletTransactions(userId: string, page = 1, limit = 200) {
    const user = await this.context(userId);
    const where: Prisma.WalletTransactionWhereInput =
      user.role === Role.ADMIN
        ? { wallet: { vendor: { branchId: user.adminProfile?.branchId } } }
        : {};
    return this.repo.listWalletTransactions(where, (page - 1) * limit, limit);
  }

  private async adjustVendorWallet(
    userId: string,
    vendorId: string,
    delta: number,
    type: WalletTxnType,
    note?: string
  ) {
    const user = await this.context(userId);
    await this.assertVendorScope(user, vendorId);
    if (delta === 0) throw createHttpError(400, "Amount must be non-zero.");
    return this.repo.adjustWallet(vendorId, delta, type, note);
  }

  private async assertVendorScope(
    user: Awaited<ReturnType<AdminRepository["findUser"]>>,
    vendorId: string
  ) {
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user?.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Vendor is outside your branch.");
    }
    return vendor;
  }

  async adminComplaints(userId: string, page = 1, limit = 20) {
    const user = await this.context(userId);
    const where = user.role === Role.ADMIN ? { vendor: { branchId: user.adminProfile?.branchId } } : {};
    const [data, total] = await Promise.all([
      this.repo.listComplaints(where, (page - 1) * limit, limit),
      this.repo.countComplaints(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async adminComplaintReply(userId: string, complaintId: string, reply: string, status?: string) {
    const user = await this.context(userId);
    const complaint = await this.repo.findComplaint(complaintId);
    if (!complaint) throw createHttpError(404, "Complaint not found.");
    if (user.role === Role.ADMIN && complaint.vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Complaint is outside your branch.");
    }
    return this.repo.updateComplaint(complaintId, {
      adminReply: reply,
      status: status as VendorComplaintStatus | undefined,
    });
  }

  async payments(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : undefined;
    const where = branchId
      ? { OR: [{ order: { branchId } }, { lead: { branchId } }, { serviceRequest: { branchId } }] }
      : {};
    const data = await this.repo.listPayments(where, (page - 1) * limit, limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.max(1, Math.ceil(data.length / limit)),
      },
    };
  }

  async confirmPayment(userId: string, paymentId: string, approved: boolean, transactionId?: string) {
    const user = await this.context(userId);
    const payment = await this.repo.findPayment(paymentId);
    if (!payment) throw createHttpError(404, "Payment not found.");
    const branchId = payment.order?.branchId ?? payment.lead?.branchId ?? payment.serviceRequest?.branchId;
    if (user.role === Role.ADMIN && branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Payment is outside your branch.");
    }
    if (!approved) return this.repo.updatePayment(paymentId, { status: PaymentStatus.FAILED, transactionId });
    if (payment.leadId) return this.verifyLeadPayment(paymentId);
    return this.repo.updatePayment(paymentId, { status: PaymentStatus.PAID, transactionId });
  }

  private async verifyLeadPayment(paymentId: string) {
    const { Prisma } = await import("../../generated/prisma/client");
    const result = await this.repo.confirmPayment(
      paymentId,
      new Prisma.Decimal(process.env.VENDOR_COMMISSION_PERCENT ?? DEFAULT_COMMISSION_PERCENT)
    );
    if (result.commission) {
      const credited = await this.creditCommission(result.commission.id);
      if (credited) {
        await this.repo.notifyVendor(
          credited.vendorId,
          "Commission credited",
          `Commission ${credited.amount} coins credited.`,
          "COMMISSION_CREDITED"
        );
      }
    }
    return result;
  }

  private async creditCommission(commissionId: string) {
    return this.repo.creditCommission(commissionId);
  }

  async products(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const where = this.branchFilter(user.role, user.adminProfile?.branchId);
    const [data, total] = await Promise.all([
      this.repo.listProducts(where, (page - 1) * limit, limit),
      this.repo.countProducts(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async product(userId: string, id: string) {
    const user = await this.context(userId);
    const product = await this.repo.findProductById(id);
    if (!product) throw createHttpError(404, "Product not found.");
    if (user.role === Role.ADMIN && product.branchId && product.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Product is outside your branch.");
    }
    return product;
  }

  async createProduct(
    userId: string,
    data: Prisma.ProductUncheckedCreateInput,
    imageBuffers?: Buffer[]
  ) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;

    const cleanedData = cleanProductInput(data);
    let images: string[] = Array.isArray(cleanedData.images) ? [...cleanedData.images] : [];
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "just24you/products");
      images = [...images, ...uploadedUrls];
    }

    return this.repo.createProduct({
      ...cleanedData,
      images,
      branchId: branchId || undefined,
    });
  }

  async updateProduct(
    userId: string,
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
    imageBuffers?: Buffer[]
  ) {
    const user = await this.context(userId);
    const existing = await this.repo.listProducts({ id }, 0, 1);
    if (!existing[0]) throw createHttpError(404, "Product not found.");
    if (user.role === Role.ADMIN && existing[0].branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Product is outside your branch.");
    }

    let images = data.images as string[] | undefined;
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "just24you/products");
      const baseImages = images !== undefined ? (Array.isArray(images) ? images : []) : existing[0].images;
      images = [...baseImages, ...uploadedUrls];
    }

    const safeData = user.role === Role.ADMIN
      ? (() => { const { branchId: _branchId, ...rest } = data as any; return rest; })()
      : data;

    const cleanedData = cleanProductInput(safeData);

    if (images !== undefined) {
      cleanedData.images = images;
    }

    return this.repo.updateProduct(id, cleanedData);
  }

  async deleteProduct(userId: string, id: string) {
    const user = await this.context(userId);
    const existing = await this.repo.listProducts({ id }, 0, 1);
    if (!existing[0]) throw createHttpError(404, "Product not found.");
    if (user.role === Role.ADMIN && existing[0].branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Product is outside your branch.");
    }
    return this.repo.deleteProduct(id);
  }

  async parts(userId: string, page: number, limit: number) {
    await this.context(userId);
    const where: Prisma.PartWhereInput = { isActive: true };
    const [data, total] = await Promise.all([
      this.repo.listParts(where, (page - 1) * limit, limit),
      this.repo.countParts(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async part(userId: string, id: string) {
    await this.context(userId);
    const part = await this.repo.findPartById(id);
    if (!part) throw createHttpError(404, "Part not found.");
    return part;
  }

  async createPart(userId: string, data: any, imageBuffers?: Buffer[]) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;

    const cleanedData = cleanPartInput(data);
    let images: string[] = Array.isArray(cleanedData.images) ? [...cleanedData.images] : [];
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "just24you/parts");
      images = [...images, ...uploadedUrls];
    }

    const { stock = 0, branchId: _ignored, ...catalog } = cleanedData;
    return this.repo.createPart({ ...catalog, images }, branchId || undefined, stock);
  }

  async updatePart(userId: string, id: string, data: any, imageBuffers?: Buffer[]) {
    await this.context(userId);
    const existing = await this.repo.findPartById(id);
    if (!existing) throw createHttpError(404, "Part not found.");

    const cleanedData = cleanPartInput(data);
    let images = cleanedData.images as string[] | undefined;
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "just24you/parts");
      const baseImages = images !== undefined ? (Array.isArray(images) ? images : []) : existing.images;
      images = [...baseImages, ...uploadedUrls];
    }
    const updateData: any = { ...cleanedData };
    if (images !== undefined) {
      updateData.images = images;
    }
    return this.repo.updatePart(id, updateData);
  }

  async deletePart(userId: string, id: string) {
    await this.context(userId);
    const existing = await this.repo.findPartById(id);
    if (!existing) throw createHttpError(404, "Part not found.");
    return this.repo.deletePart(id);
  }

  async uploadProductImage(fileBuffer: Buffer) {
    return uploadProductImage(fileBuffer, "just24you/products");
  }

  async uploadPartImage(fileBuffer: Buffer) {
    return uploadPartImage(fileBuffer, "just24you/parts");
  }

  async services(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const where = this.branchFilter(user.role, user.adminProfile?.branchId);
    const [data, total] = await Promise.all([
      this.repo.listServices(where, (page - 1) * limit, limit),
      this.repo.countServices(where),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createService(userId: string, data: Prisma.ServiceUncheckedCreateInput) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;
    return this.repo.createService({ ...data, branchId: branchId || undefined });
  }

  async updateService(userId: string, id: string, data: Prisma.ServiceUncheckedUpdateInput) {
    const user = await this.context(userId);
    const existing = await this.repo.listServices({ id }, 0, 1);
    if (!existing[0]) throw createHttpError(404, "Service not found.");
    if (user.role === Role.ADMIN && existing[0].branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Service is outside your branch.");
    }
    const safeData = user.role === Role.ADMIN
      ? (() => { const { branchId: _branchId, ...rest } = data as any; return rest; })()
      : data;
    return this.repo.updateService(id, safeData);
  }

  async categories(userId: string, query: AdminCategoryQueryDto) {
    await this.context(userId);
    const { page = 1, limit = 50, type, search, isActive } = query;

    const where: Prisma.CategoryWhereInput = {
      ...(type ? { type } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.repo.listCategories(where, (page - 1) * limit, limit),
      this.repo.countCategories(where),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async category(userId: string, categoryId: string) {
    await this.context(userId);
    const category = await this.repo.findCategory(categoryId);
    if (!category) throw createHttpError(404, "Category not found.");
    return category;
  }

  async createCategory(userId: string, input: AdminCategoryDto) {
    await this.context(userId);
    const slug =
      input.slug?.trim().toLowerCase().replace(/\s+/g, "-") ||
      input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const existing = await this.repo.listCategories({
      OR: [{ name: input.name.trim() }, { slug }],
    }, 0, 1);

    if (existing[0]) {
      throw createHttpError(409, "A category with that name or slug already exists.");
    }

    const created = await this.repo.createCategory({
      name: input.name.trim(),
      slug,
      type: input.type,
      icon: input.icon,
      image: input.image,
      description: input.description,
      isActive: input.isActive !== undefined ? input.isActive : true,
    });

    await this.audit(userId, "CATEGORY_CREATED", "Category", created.id, {
      name: created.name,
      type: created.type,
    });

    return created;
  }

  async updateCategory(userId: string, categoryId: string, input: Partial<AdminCategoryDto>) {
    await this.context(userId);
    const existing = await this.repo.findCategory(categoryId);
    if (!existing) throw createHttpError(404, "Category not found.");

    let slug = input.slug?.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug && input.name && input.name !== existing.name) {
      slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    if (input.name && input.name !== existing.name) {
      const duplicate = await this.repo.listCategories({
        name: input.name.trim(),
        id: { not: categoryId },
      }, 0, 1);
      if (duplicate[0]) {
        throw createHttpError(409, "Another category already uses this name.");
      }
    }

    const updated = await this.repo.updateCategory(categoryId, {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(slug ? { slug } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    await this.audit(userId, "CATEGORY_UPDATED", "Category", categoryId, input);
    return updated;
  }

  async deleteCategory(userId: string, categoryId: string) {
    await this.context(userId);
    const category = await this.repo.findCategory(categoryId);
    if (!category) throw createHttpError(404, "Category not found.");

    if (category._count.products > 0 || category._count.services > 0) {
      throw createHttpError(
        400,
        `Cannot delete category. It has ${category._count.products} product(s) and ${category._count.services} service(s) linked to it.`
      );
    }

    await this.repo.deleteCategory(categoryId);
    await this.audit(userId, "CATEGORY_DELETED", "Category", categoryId, { name: category.name });
    return { success: true, message: "Category deleted successfully." };
  }

  async complaints(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const where = user.role === Role.ADMIN ? { vendor: { branchId: user.adminProfile?.branchId } } : {};
    const data = await this.repo.listComplaints(where, (page - 1) * limit, limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.max(1, Math.ceil(data.length / limit)),
      },
    };
  }

  async replyComplaint(userId: string, complaintId: string, reply: string, status?: string) {
    const user = await this.context(userId);
    const complaint = await this.repo.findComplaint(complaintId);
    if (!complaint) throw createHttpError(404, "Complaint not found.");
    if (user.role === Role.ADMIN && complaint.vendor.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Complaint is outside your branch.");
    }
    return this.repo.updateComplaint(complaintId, {
      adminReply: reply,
      status: status as VendorComplaintStatus | undefined,
    });
  }

  async users(userId: string, page: number, limit: number) {
    await this.requireSuperAdmin(userId);
    const [data, total] = await Promise.all([
      this.repo.listUsers((page - 1) * limit, limit),
      this.repo.countUsers(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateUserStatus(userId: string, targetId: string, isActive: boolean) {
    await this.requireSuperAdmin(userId);
    if (userId === targetId) throw createHttpError(400, "You cannot deactivate your own account.");
    return this.repo.updateUser(targetId, { isActive, updatedBy: userId });
  }

  async updateUserRole(userId: string, targetId: string, role: Role) {
    await this.requireSuperAdmin(userId);
    if (!Object.values(Role).includes(role)) {
      throw createHttpError(400, "Invalid user role.");
    }
    if (targetId === userId && role !== Role.SADMIN) {
      throw createHttpError(400, "You cannot demote your own account.");
    }
    const target = await this.repo.findUserById(targetId);
    if (!target) throw createHttpError(404, "User not found.");

    if (
      target.role === Role.SADMIN &&
      role !== Role.SADMIN &&
      (await this.repo.countSuperAdmins()) <= 1
    ) {
      throw createHttpError(409, "At least one Super Admin must remain.");
    }

    const updated = await this.repo.updateUserRole(targetId, role, userId);
    await this.audit(userId, "USER_ROLE_CHANGED", "User", targetId, { from: target.role, to: role });
    return updated;
  }

  async createAdmin(
    userId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      password?: string;
      branchId?: string;
      jobTitle?: string;
    }
  ) {
    await this.requireSuperAdmin(userId);
    const existing = await this.repo.findUserByEmail(data.email);
    if (existing && !existing.deletedAt) {
      throw createHttpError(409, "An account with this email already exists.");
    }
    if (data.branchId) {
      const branch = await this.repo.findBranch(data.branchId);
      if (!branch || !branch.isActive) {
        throw createHttpError(400, "The selected branch is invalid or inactive.");
      }
    }
    const plainPassword = data.password ?? generateRandomPassword();
    const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const admin = await this.repo.createAdmin({ ...data, password: hashed });
    await this.audit(userId, "ADMIN_CREATED", "User", admin.id, {
      role: "ADMIN",
      branchId: data.branchId ?? null,
    });

    const { subject, html } = adminWelcomeEmail(
      data.firstName,
      data.email,
      plainPassword,
      admin.adminProfile?.branch?.name
    );
    const mailSent = await sendMail({ to: data.email, subject, html }).then(() => true).catch(() => false);
    return {
      ...admin,
      temporaryPassword: data.password ? undefined : plainPassword,
      welcomeEmailSent: mailSent,
    };
  }

  async admins(userId: string, page: number, limit: number) {
    await this.requireSuperAdmin(userId);
    const [data, total] = await Promise.all([
      this.repo.listAdmins((page - 1) * limit, limit),
      this.repo.countAdmins(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateAdmin(
    userId: string,
    targetId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      branchId?: string | null;
      jobTitle?: string | null;
      isActive?: boolean;
    }
  ) {
    await this.requireSuperAdmin(userId);
    const target = await this.repo.findAdminById(targetId);
    if (!target) throw createHttpError(404, "Admin not found.");
    if (target.id === userId && data.isActive === false) {
      throw createHttpError(400, "You cannot deactivate your own account.");
    }
    if (data.email && data.email !== target.email) {
      const duplicate = await this.repo.findUserByEmail(data.email);
      if (duplicate && duplicate.id !== targetId && !duplicate.deletedAt) {
        throw createHttpError(409, "An account with that email already exists.");
      }
    }
    if (data.branchId) {
      const branch = await this.repo.findBranch(data.branchId);
      if (!branch || !branch.isActive) {
        throw createHttpError(400, "The selected branch is invalid or inactive.");
      }
    }
    const updated = await this.repo.updateAdmin(targetId, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      isActive: data.isActive,
      updatedBy: userId,
      adminProfile: { update: { branchId: data.branchId, jobTitle: data.jobTitle } },
    });
    await this.audit(userId, "ADMIN_UPDATED", "User", targetId, data);
    return updated;
  }

  async changeAdminRole(
    userId: string,
    targetId: string,
    role: Extract<Role, "ADMIN" | "SADMIN">
  ) {
    await this.requireSuperAdmin(userId);
    if (targetId === userId && role !== Role.SADMIN) {
      throw createHttpError(400, "You cannot demote your own account.");
    }
    const target = await this.repo.findAdminById(targetId);
    if (!target) throw createHttpError(404, "Admin not found.");
    if (target.role === Role.SADMIN && role === Role.ADMIN && (await this.repo.countSuperAdmins()) <= 1) {
      throw createHttpError(409, "At least one Super Admin must remain.");
    }
    const updated = await this.repo.updateUserRole(targetId, role, userId);
    await this.audit(userId, "ADMIN_ROLE_CHANGED", "User", targetId, { from: target.role, to: role });
    return updated;
  }

  async resetAdminPassword(userId: string, targetId: string, newPassword: string) {
    await this.requireSuperAdmin(userId);
    const target = await this.repo.findAdminById(targetId);
    if (!target) throw createHttpError(404, "Admin not found.");
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await this.repo.resetAdminPassword(targetId, hashed, userId);
    await this.audit(userId, "ADMIN_PASSWORD_RESET", "User", targetId);
    return result;
  }

  async auditLogs(userId: string, query: any) {
    await this.requireSuperAdmin(userId);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const result = await this.repo.listAuditLogs({
      skip: (page - 1) * limit,
      take: limit,
      actorId: typeof query.actorId === "string" ? query.actorId : undefined,
      action: typeof query.action === "string" ? query.action : undefined,
      entityType: typeof query.entityType === "string" ? query.entityType : undefined,
      from: typeof query.from === "string" ? new Date(query.from) : undefined,
      to: typeof query.to === "string" ? new Date(query.to) : undefined,
    });
    return { data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
  }

  private audit(
    actorId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) {
    return this.repo.createAuditLog({
      actorType: "ADMIN",
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata as Prisma.InputJsonValue,
    });
  }

  async branches(userId: string, page: number, limit: number) {
    await this.requireSuperAdmin(userId);
    const [data, total] = await Promise.all([
      this.repo.listBranches((page - 1) * limit, limit),
      this.repo.countBranches(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createBranch(userId: string, data: Prisma.BranchUncheckedCreateInput) {
    await this.requireSuperAdmin(userId);
    return this.repo.createBranch(data);
  }

  async updateBranch(userId: string, id: string, data: Prisma.BranchUncheckedUpdateInput) {
    await this.requireSuperAdmin(userId);
    return this.repo.updateBranch(id, data);
  }

  async settings(userId: string) {
    await this.requireSuperAdmin(userId);
    return this.repo.listSettings();
  }

  async upsertSetting(userId: string, key: string, value: Prisma.InputJsonValue, description?: string) {
    await this.requireSuperAdmin(userId);
    return this.repo.upsertSetting(key, value, description);
  }

  async report(userId: string) {
    const user = await this.context(userId);
    const where = user.role === Role.ADMIN ? { branchId: user.adminProfile?.branchId } : {};
    const [dashboard, paymentSummary, lowRated, pendingVendors, pendingLeads, pendingPayments] = await Promise.all([
      this.repo.dashboard(user.role === Role.ADMIN ? user.adminProfile?.branchId ?? undefined : undefined),
      this.repo.paymentSummary(user.role === Role.ADMIN ? user.adminProfile?.branchId ?? undefined : undefined),
      this.repo.countVendors({ ...where, profileStatus: VendorProfileStatus.BLOCKED }),
      this.repo.countVendors({ ...where, verificationStatus: VendorVerificationStatus.PENDING }),
      this.repo.countLeads({ ...where, status: LeadStatus.PENDING_START_VERIFICATION }),
      this.repo.listPayments(
        user.role === Role.ADMIN
          ? { OR: [{ order: { branchId: user.adminProfile?.branchId } }, { lead: { branchId: user.adminProfile?.branchId } }, { serviceRequest: { branchId: user.adminProfile?.branchId } }] }
          : {},
        0,
        1000
      ),
    ]);
    return {
      dashboard,
      paymentSummary,
      blockedVendors: lowRated,
      pendingVendors,
      pendingStartProofs: pendingLeads,
      pendingPayments: pendingPayments.length,
    };
  }

  async notifications(userId: string, query: AdminNotificationQueryDto) {
    const user = await this.context(userId);
    const { page = 1, limit = 20, isRead, type } = query;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined ? { isRead } : {}),
      ...(type ? { type } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.repo.listAdminNotifications(where, (page - 1) * limit, limit),
      this.repo.countAdminNotifications(where),
      this.repo.countAdminNotifications({ userId, isRead: false }),
    ]);

    return {
      items,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.context(userId);
    return this.repo.markNotificationAsRead(notificationId);
  }

  async markAllNotificationsRead(userId: string) {
    await this.context(userId);
    return this.repo.markAllNotificationsAsRead({ userId });
  }

  async deleteNotification(userId: string, notificationId: string) {
    await this.context(userId);
    return this.repo.deleteNotification(notificationId);
  }

  async clearReadNotifications(userId: string) {
    await this.context(userId);
    return this.repo.clearReadNotifications({ userId });
  }

  async broadcastNotification(userId: string, input: AdminBroadcastNotificationDto) {
    const user = await this.context(userId);
    const { title, message, type = "ANNOUNCEMENT", target, branchId } = input;

    if (user.role === Role.ADMIN && branchId && branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Cannot broadcast outside your branch.");
    }

    const effectiveBranchId =
      user.role === Role.ADMIN ? user.adminProfile?.branchId || undefined : branchId;

    if (target === "ALL_TECHNICIANS" || target === "BRANCH_TECHNICIANS") {
      await this.repo.notifyAllVendors(title, message, type, effectiveBranchId);
    } else if (target === "ALL_CUSTOMERS") {
      await this.repo.notifyAllCustomers(title, message, type);
    } else if (target === "ALL_ADMINS") {
      await this.repo.notifyAllAdmins(title, message, type, effectiveBranchId);
    }

    await this.audit(userId, "ADMIN_NOTIFICATION_BROADCAST", "Notification", undefined, {
      title,
      target,
      branchId: effectiveBranchId,
    });

    return { success: true, message: `Notification broadcasted to ${target}.` };
  }

  async notifyAdmins(title: string, message: string, type: string, branchId?: string) {
    try {
      await this.repo.notifyAllAdmins(title, message, type, branchId);
    } catch (err) {
      console.error("[Notify Admins Error]", err);
    }
  }

  private async requireSuperAdmin(userId: string) {
    const user = await this.context(userId);
    if (user.role !== Role.SADMIN) throw createHttpError(403, "Super Admin access required.");
    return user;
  }
}
