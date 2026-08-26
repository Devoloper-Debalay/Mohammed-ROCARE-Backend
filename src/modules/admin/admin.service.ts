import { injectable, inject } from "tsyringe";
import type { Prisma } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { AdminRepository } from "./admin.repository";
import { OrderStatus, PaymentStatus, Role, VendorComplaintStatus, VendorProfileStatus, VendorVerificationStatus, WalletTxnType, LeadStatus } from "../../generated/prisma/enums";
import { sendMail } from "../../utils/mailer";
import { adminWelcomeEmail } from "../../utils/vendorMailTemplates";
import { generateRandomPassword } from "../../utils/passwordGenerator";

const SALT_ROUNDS = 10;
const DEFAULT_COMMISSION_PERCENT = 10;

@injectable()
export class AdminService {
  constructor(@inject(AdminRepository) private readonly repo: AdminRepository) {}


  async context(userId: string) {
    const user = await this.repo.findUser(userId);
    if (!user || !user.isActive || user.deletedAt) throw createHttpError(403, "Admin account is inactive.");
    if (user.role !== Role.ADMIN && user.role !== Role.SADMIN) throw createHttpError(403, "Admin access required.");
    if (user.role === Role.ADMIN && !user.adminProfile?.branchId) throw createHttpError(403, "Admin is not assigned to a branch.");
    return user;
  }

  private branchFilter(role: Role, branchId: string | null | undefined, requested?: string) {
    if (role === Role.SADMIN) return requested ? { branchId: requested } : {};
    if (!branchId) throw createHttpError(403, "Admin branch is not configured.");
    return { branchId };
  }

  async vendors(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const where = { deletedAt: null, ...this.branchFilter(user.role, user.adminProfile?.branchId) };
    const [data, total] = await Promise.all([this.repo.listVendors(where, (page - 1) * limit, limit), this.repo.countVendors(where)]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async verifyVendor(userId: string, vendorId: string, approved: boolean, reason?: string) {
    const user = await this.context(userId);
    const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Vendor is outside your branch.");
    return this.repo.updateVendor(vendorId, { verificationStatus: approved ? VendorVerificationStatus.VERIFIED : VendorVerificationStatus.REJECTED, rejectionReason: approved ? null : (reason ?? "Rejected by admin.") });
  }

  async publishVendor(userId: string, vendorId: string) {
    const user = await this.context(userId); const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Vendor is outside your branch.");
    if (vendor.verificationStatus !== VendorVerificationStatus.VERIFIED) throw createHttpError(409, "Vendor must be verified before publishing.");
    return this.repo.updateVendor(vendorId, { profileStatus: VendorProfileStatus.PUBLISHED });
  }

  async unblockVendor(userId: string, vendorId: string) {
    const user = await this.context(userId); const vendor = await this.repo.findVendor(vendorId);
    if (!vendor) throw createHttpError(404, "Vendor not found.");
    if (user.role === Role.ADMIN && vendor.branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Vendor is outside your branch.");
    return this.repo.updateVendor(vendorId, { profileStatus: VendorProfileStatus.PUBLISHED });
  }

  async assignVendorBranch(userId: string, vendorId: string, branchId: string) {
    await this.context(userId);
    return this.repo.updateVendor(vendorId, { branchId });
  }

  async leads(userId: string, page: number, limit: number, branchId?: string) {
    const user = await this.context(userId); const where = this.branchFilter(user.role, user.adminProfile?.branchId, branchId);
    const [data, total] = await Promise.all([this.repo.listLeads(where, (page - 1) * limit, limit), this.repo.countLeads(where)]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async pendingStartProofs(userId: string) {
    const user = await this.context(userId);
    return this.repo.pendingStartProofs(user.role === Role.ADMIN ? (user.adminProfile?.branchId ?? undefined) : undefined);
  }

  async pendingDenialProofs(userId: string) {
    const user = await this.context(userId);
    return this.repo.pendingDenialProofs(user.role === Role.ADMIN ? (user.adminProfile?.branchId ?? undefined) : undefined);
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

  async reviewDenialProof(userId: string, proofId: string, approved: boolean) {
    const user = await this.context(userId);
    const proof = await this.repo.findDenialProof(proofId);
    if (!proof) throw createHttpError(404, "Denial proof not found.");
    if (user.role === Role.ADMIN && proof.lead.branchId !== user.adminProfile?.branchId) {
      throw createHttpError(403, "Lead is outside your branch.");
    }
    return this.repo.reviewDenialProof(proofId, approved);
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

  private async adjustVendorWallet(userId: string, vendorId: string, delta: number, type: WalletTxnType, note?: string) {
    const user = await this.context(userId);
    await this.assertVendorScope(user, vendorId);
    if (delta === 0) throw createHttpError(400, "Amount must be non-zero.");
    return this.repo.adjustWallet(vendorId, delta, type, note);
  }

  private async assertVendorScope(user: Awaited<ReturnType<AdminRepository["findUser"]>>, vendorId: string) {
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
    return this.repo.updateComplaint(complaintId, { adminReply: reply, status: status as VendorComplaintStatus | undefined });
  }

  async orders(userId: string, page: number, limit: number) {
    const user = await this.context(userId); const where = this.branchFilter(user.role, user.adminProfile?.branchId);
    const [data, total] = await Promise.all([this.repo.listOrders(where, (page - 1) * limit, limit), this.repo.countOrders(where)]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateOrder(userId: string, orderId: string, status: OrderStatus) {
    const user = await this.context(userId); const order = await this.repo.findOrder(orderId);
    if (!order) throw createHttpError(404, "Order not found.");
    if (user.role === Role.ADMIN && order.branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Order is outside your branch.");
    return this.repo.updateOrder(orderId, { status });
  }

  async payments(userId: string, page: number, limit: number) {
    const user = await this.context(userId);
    const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : undefined;
    const where = branchId ? { OR: [{ order: { branchId } }, { lead: { branchId } }, { serviceRequest: { branchId } }] } : {};
    const data = await this.repo.listPayments(where, (page - 1) * limit, limit);
    return { data, pagination: { page, limit, total: data.length, totalPages: Math.max(1, Math.ceil(data.length / limit)) } };
  }

  async confirmPayment(userId: string, paymentId: string, approved: boolean, transactionId?: string) {
    const user = await this.context(userId);
    const payment = await this.repo.findPayment(paymentId);
    if (!payment) throw createHttpError(404, "Payment not found.");
    const branchId = payment.order?.branchId ?? payment.lead?.branchId ?? payment.serviceRequest?.branchId;
    if (user.role === Role.ADMIN && branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Payment is outside your branch.");
    if (!approved) return this.repo.updatePayment(paymentId, { status: PaymentStatus.FAILED, transactionId });
    if (payment.leadId) return this.verifyLeadPayment(paymentId);
    return this.repo.updatePayment(paymentId, { status: PaymentStatus.PAID, transactionId });
  }

  private async verifyLeadPayment(paymentId: string) {
    const result = await this.repo.prismaVerifyLeadPayment(paymentId, Number(process.env.VENDOR_COMMISSION_PERCENT ?? DEFAULT_COMMISSION_PERCENT));
    if (result.commission) {
      const credited = await this.creditCommission(result.commission.id);
      if (credited) {
        await this.repo.notifyVendor(credited.vendorId, "Commission credited", `Commission ${credited.amount} coins credited.`, "COMMISSION_CREDITED");
      }
    }
    return result;
  }

  private async creditCommission(commissionId: string) {
    return this.repo.creditCommission(commissionId);
  }

  async products(userId: string, page: number, limit: number) {
    const user = await this.context(userId); const where = this.branchFilter(user.role, user.adminProfile?.branchId);
    const [data, total] = await Promise.all([this.repo.listProducts(where, (page - 1) * limit, limit), this.repo.countProducts(where)]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createProduct(userId: string, data: Prisma.ProductUncheckedCreateInput) {
    const user = await this.context(userId); const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;
    if (!branchId) throw createHttpError(400, "branchId is required.");
    return this.repo.createProduct({ ...data, branchId });
  }

  async updateProduct(userId: string, id: string, data: Prisma.ProductUncheckedUpdateInput) {
    const user = await this.context(userId); const existing = await this.repo.listProducts({ id }, 0, 1); if (!existing[0]) throw createHttpError(404, "Product not found.");
    if (user.role === Role.ADMIN && existing[0].branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Product is outside your branch.");
    return this.repo.updateProduct(id, data);
  }

  async services(userId: string, page: number, limit: number) { const user = await this.context(userId); const where = this.branchFilter(user.role, user.adminProfile?.branchId); const [data, total] = await Promise.all([this.repo.listServices(where, (page - 1) * limit, limit), this.repo.countServices(where)]); return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }

  async createService(userId: string, data: Prisma.ServiceUncheckedCreateInput) {
    const user = await this.context(userId); const branchId = user.role === Role.ADMIN ? user.adminProfile?.branchId : data.branchId;
    if (!branchId) throw createHttpError(400, "branchId is required.");
    return this.repo.createService({ ...data, branchId });
  }

  async updateService(userId: string, id: string, data: Prisma.ServiceUncheckedUpdateInput) {
    const user = await this.context(userId); const existing = await this.repo.listServices({ id }, 0, 1); if (!existing[0]) throw createHttpError(404, "Service not found.");
    if (user.role === Role.ADMIN && existing[0].branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Service is outside your branch.");
    return this.repo.updateService(id, data);
  }

  async complaints(userId: string, page: number, limit: number) {
    const user = await this.context(userId); const where = user.role === Role.ADMIN ? { vendor: { branchId: user.adminProfile?.branchId } } : {};
    const data = await this.repo.listComplaints(where, (page - 1) * limit, limit);
    return { data, pagination: { page, limit, total: data.length, totalPages: Math.max(1, Math.ceil(data.length / limit)) } };
  }

  async replyComplaint(userId: string, complaintId: string, reply: string, status?: string) {
    const user = await this.context(userId); const complaint = await this.repo.findComplaint(complaintId);
    if (!complaint) throw createHttpError(404, "Complaint not found.");
    if (user.role === Role.ADMIN && complaint.vendor.branchId !== user.adminProfile?.branchId) throw createHttpError(403, "Complaint is outside your branch.");
    return this.repo.updateComplaint(complaintId, { adminReply: reply, status: status as VendorComplaintStatus | undefined });
  }

  async users(userId: string, page: number, limit: number) {
    await this.requireSuperAdmin(userId); const [data, total] = await Promise.all([this.repo.listUsers((page - 1) * limit, limit), this.repo.countUsers()]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateUserStatus(userId: string, targetId: string, isActive: boolean) { await this.requireSuperAdmin(userId); if (userId === targetId) throw createHttpError(400, "You cannot deactivate your own account."); return this.repo.updateUser(targetId, { isActive, updatedBy: userId }); }

  async updateUserRole(userId: string, targetId: string, role: Role) {
    if (role !== Role.ADMIN && role !== Role.SADMIN) throw createHttpError(400, "User role can only be changed to ADMIN or SADMIN here.");
    return this.changeAdminRole(userId, targetId, role);
  }

  async createAdmin(userId: string, data: { firstName: string; lastName: string; email: string; phone?: string; password?: string; branchId?: string; jobTitle?: string }) {
    await this.requireSuperAdmin(userId);
    const existing = await this.repo.findUserByEmail(data.email);
    if (existing && !existing.deletedAt) throw createHttpError(409, "An account with this email already exists.");
    if (data.branchId) {
      const branch = await this.repo.findBranch(data.branchId);
      if (!branch || !branch.isActive) throw createHttpError(400, "The selected branch is invalid or inactive.");
    }
    const plainPassword = data.password ?? generateRandomPassword();
    const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const admin = await this.repo.createAdmin({ ...data, password: hashed });
    await this.audit(userId, "ADMIN_CREATED", "User", admin.id, { role: "ADMIN", branchId: data.branchId ?? null });

    const { subject, html } = adminWelcomeEmail(data.firstName, data.email, plainPassword, admin.adminProfile?.branch?.name);
    const mailSent = await sendMail({ to: data.email, subject, html }).then(() => true).catch(() => false);
    return { ...admin, temporaryPassword: data.password ? undefined : plainPassword, welcomeEmailSent: mailSent };
  }

  async admins(userId: string, page: number, limit: number) {
    await this.requireSuperAdmin(userId);
    const [data, total] = await Promise.all([this.repo.listAdmins((page - 1) * limit, limit), this.repo.countAdmins()]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateAdmin(userId: string, targetId: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string; branchId?: string | null; jobTitle?: string | null; isActive?: boolean }) {
    await this.requireSuperAdmin(userId);
    const target = await this.repo.findAdminById(targetId);
    if (!target) throw createHttpError(404, "Admin not found.");
    if (target.id === userId && data.isActive === false) throw createHttpError(400, "You cannot deactivate your own account.");
    if (data.email && data.email !== target.email) {
      const duplicate = await this.repo.findUserByEmail(data.email);
      if (duplicate && duplicate.id !== targetId && !duplicate.deletedAt) throw createHttpError(409, "An account with that email already exists.");
    }
    if (data.branchId) {
      const branch = await this.repo.findBranch(data.branchId);
      if (!branch || !branch.isActive) throw createHttpError(400, "The selected branch is invalid or inactive.");
    }
    const updated = await this.repo.updateAdmin(targetId, {
      firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone,
      isActive: data.isActive, updatedBy: userId,
      adminProfile: { update: { branchId: data.branchId, jobTitle: data.jobTitle } },
    });
    await this.audit(userId, "ADMIN_UPDATED", "User", targetId, data);
    return updated;
  }

  async changeAdminRole(userId: string, targetId: string, role: Extract<Role, "ADMIN" | "SADMIN">) {
    await this.requireSuperAdmin(userId);
    if (targetId === userId && role !== Role.SADMIN) throw createHttpError(400, "You cannot demote your own account.");
    const target = await this.repo.findAdminById(targetId);
    if (!target) throw createHttpError(404, "Admin not found.");
    if (target.role === Role.SADMIN && role === Role.ADMIN && (await this.repo.countSuperAdmins()) <= 1) {
      throw createHttpError(409, "At least one Super Admin must remain.");
    }
    const updated = await this.repo.updateAdminRole(targetId, role, userId);
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
      skip: (page - 1) * limit, take: limit,
      actorId: typeof query.actorId === "string" ? query.actorId : undefined,
      action: typeof query.action === "string" ? query.action : undefined,
      entityType: typeof query.entityType === "string" ? query.entityType : undefined,
      from: typeof query.from === "string" ? new Date(query.from) : undefined,
      to: typeof query.to === "string" ? new Date(query.to) : undefined,
    });
    return { data: result.data, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
  }

  private audit(actorId: string, action: string, entityType?: string, entityId?: string, metadata?: Record<string, unknown>) {
    return this.repo.createAuditLog({ actorType: "ADMIN", actorId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue });
  }

  async branches(userId: string, page: number, limit: number) { await this.requireSuperAdmin(userId); const [data, total] = await Promise.all([this.repo.listBranches((page - 1) * limit, limit), this.repo.countBranches()]); return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }
  async createBranch(userId: string, data: Prisma.BranchUncheckedCreateInput) { await this.requireSuperAdmin(userId); return this.repo.createBranch(data); }
  async updateBranch(userId: string, id: string, data: Prisma.BranchUncheckedUpdateInput) { await this.requireSuperAdmin(userId); return this.repo.updateBranch(id, data); }

  async settings(userId: string) { await this.requireSuperAdmin(userId); return this.repo.listSettings(); }
  async upsertSetting(userId: string, key: string, value: Prisma.InputJsonValue, description?: string) { await this.requireSuperAdmin(userId); return this.repo.upsertSetting(key, value, description); }

  async report(userId: string) {
    const user = await this.context(userId); const where = user.role === Role.ADMIN ? { branchId: user.adminProfile?.branchId } : {};
    const [dashboard, paymentSummary, lowRated, pendingVendors, pendingLeads, pendingPayments] = await Promise.all([
      this.repo.dashboard(user.role === Role.ADMIN ? user.adminProfile?.branchId ?? undefined : undefined),
      this.repo.paymentSummary(user.role === Role.ADMIN ? user.adminProfile?.branchId ?? undefined : undefined),
      this.repo.countVendors({ ...where, profileStatus: VendorProfileStatus.BLOCKED }),
      this.repo.countVendors({ ...where, verificationStatus: VendorVerificationStatus.PENDING }),
      this.repo.countLeads({ ...where, status: LeadStatus.PENDING_START_VERIFICATION }),
      this.repo.listPayments(user.role === Role.ADMIN ? { OR: [{ order: { branchId: user.adminProfile?.branchId } }, { lead: { branchId: user.adminProfile?.branchId } }, { serviceRequest: { branchId: user.adminProfile?.branchId } }] } : {}, 0, 1000),
    ]);
    return { dashboard, paymentSummary, blockedVendors: lowRated, pendingVendors, pendingStartProofs: pendingLeads, pendingPayments: pendingPayments.length };
  }

  private async requireSuperAdmin(userId: string) { const user = await this.context(userId); if (user.role !== Role.SADMIN) throw createHttpError(403, "Super Admin access required."); return user; }
}
