import createHttpError from "http-errors";
import { injectable, inject } from "tsyringe";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { LeadStatus, OrderStatus, Role, VendorProfileStatus, VendorVerificationStatus, VendorRole, WalletTxnStatus, WalletTxnType } from "../../generated/prisma/enums";

@injectable()
export class AdminRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { adminProfile: { include: { branch: true } } } });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: { adminProfile: { include: { branch: true } } } });
  }

  listUsers(skip: number, take: number) {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, isActive: true, createdAt: true, updatedAt: true, adminProfile: { include: { branch: true } } },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countUsers() { return this.prisma.user.count({ where: { deletedAt: null } }); }

  listAdmins(skip: number, take: number) {
    return this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, isActive: true, createdAt: true, updatedAt: true, adminProfile: { include: { branch: true } } },
      skip, take, orderBy: { createdAt: "desc" },
    });
  }

  countAdmins() { return this.prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null } }); }

  countSuperAdmins() { return this.prisma.user.count({ where: { role: Role.SADMIN, deletedAt: null } }); }

  async updateAdmin(id: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string | null; isActive?: boolean; updatedBy?: string; adminProfile?: { update: { branchId?: string | null; jobTitle?: string | null } } }) {
    return this.prisma.user.update({ where: { id }, data, include: { adminProfile: { include: { branch: true } } } });
  }

  async ensureAdminProfile(userId: string, data: { branchId?: string | null; jobTitle?: string | null }) {
    return this.prisma.adminProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      include: { branch: true },
    });
  }

  findAdminById(id: string) {
    return this.prisma.user.findFirst({ where: { id, role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null }, include: { adminProfile: { include: { branch: true } } } });
  }

  async updateAdminRole(id: string, role: Role, updatedBy: string) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({ where: { id }, data: { role, updatedBy } });
      if (role === Role.ADMIN || role === Role.SADMIN) {
        await tx.adminProfile.upsert({ where: { userId: id }, update: {}, create: { userId: id } });
      }
      return tx.user.findUnique({ where: { id }, include: { adminProfile: { include: { branch: true } } } });
    });
  }

  async resetAdminPassword(id: string, password: string, updatedBy: string) {
    return this.prisma.user.update({ where: { id }, data: { password, updatedBy }, select: { id: true, email: true, role: true, updatedAt: true } });
  }

  async listAuditLogs(args: { skip: number; take: number; actorId?: string; action?: string; entityType?: string; from?: Date; to?: Date }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(args.actorId ? { actorId: args.actorId } : {}),
      ...(args.action ? { action: { contains: args.action, mode: "insensitive" } } : {}),
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...((args.from || args.to) ? { createdAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: args.skip, take: args.take, orderBy: { createdAt: "desc" } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }

  createAuditLog(data: { actorType: string; actorId?: string; action: string; entityType?: string; entityId?: string; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.auditLog.create({ data });
  }

  updateUser(id: string, data: { isActive?: boolean; role?: Role; updatedBy?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  createAdmin(data: { firstName: string; lastName: string; email: string; phone?: string; password: string; branchId?: string; jobTitle?: string }) {
    return this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: Role.ADMIN,
        adminProfile: { create: { branchId: data.branchId, jobTitle: data.jobTitle } },
      },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  listVendors(where: Prisma.VendorWhereInput, skip: number, take: number) {
    return this.prisma.vendor.findMany({ where, include: { kyc: true, bankDetail: true, branch: true }, skip, take, orderBy: { createdAt: "desc" } });
  }

  countVendors(where: Prisma.VendorWhereInput) { return this.prisma.vendor.count({ where }); }

  findVendor(id: string) { return this.prisma.vendor.findUnique({ where: { id }, include: { kyc: true, bankDetail: true, branch: true } }); }

  updateVendor(id: string, data: { verificationStatus?: VendorVerificationStatus; profileStatus?: VendorProfileStatus; rejectionReason?: string | null; branchId?: string | null }) {
    return this.prisma.vendor.update({ where: { id }, data, include: { branch: true } });
  }

  listLeads(where: Prisma.LeadWhereInput, skip: number, take: number) {
    return this.prisma.lead.findMany({ where, include: { assignedVendor: true, product: true, service: true, visitProofs: true, denialProofs: true, payments: true }, skip, take, orderBy: { createdAt: "desc" } });
  }

  countLeads(where: Prisma.LeadWhereInput) { return this.prisma.lead.count({ where }); }

  updateLeadStatus(id: string, status: LeadStatus) { return this.prisma.lead.update({ where: { id }, data: { status } }); }

  findStartProof(id: string) { return this.prisma.leadVisitProof.findUnique({ where: { id }, include: { lead: true, vendor: true } }); }
  findDenialProof(id: string) { return this.prisma.leadDenialProof.findUnique({ where: { id }, include: { lead: true, vendor: true } }); }

  async reviewStartProof(id: string, approved: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const proof = await tx.leadVisitProof.findUnique({ where: { id } });
      if (!proof) throw createHttpError(404, "Start proof not found.");
      await tx.leadVisitProof.update({ where: { id }, data: { verified: approved, verifiedAt: new Date() } });
      return tx.lead.update({
        where: { id: proof.leadId },
        data: { status: approved ? LeadStatus.ONGOING : LeadStatus.ACCEPTED, ...(approved ? { startVerifiedAt: new Date() } : {}) },
      });
    });
  }

  async reviewDenialProof(id: string, approved: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const proof = await tx.leadDenialProof.findUnique({ where: { id } });
      if (!proof) throw createHttpError(404, "Denial proof not found.");
      const lead = await tx.lead.findUnique({ where: { id: proof.leadId } });
      if (!lead) throw createHttpError(404, "Lead not found.");
      await tx.leadDenialProof.update({ where: { id }, data: { approved, reviewedAt: new Date() } });
      if (!approved) return tx.lead.update({ where: { id: lead.id }, data: { status: LeadStatus.ACCEPTED } });

      if (!lead.assignedVendorId) throw createHttpError(409, "Lead has no assigned vendor.");
      const wallet = await tx.wallet.findUnique({ where: { vendorId: lead.assignedVendorId } });
      if (!wallet) throw createHttpError(404, "Vendor wallet not found.");
      const refund = lead.leadAcceptanceCharge ?? new Prisma.Decimal(300);
      const existingRefund = await tx.walletTransaction.findFirst({
        where: { walletId: wallet.id, referenceId: lead.id, type: WalletTxnType.LEAD_REFUND, status: WalletTxnStatus.SUCCESS },
      });
      if (!existingRefund) {
        const balance = wallet.balance.plus(refund);
        const spent = wallet.totalSpent.greaterThanOrEqualTo(refund) ? wallet.totalSpent.minus(refund) : new Prisma.Decimal(0);
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalSpent: spent } });
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: WalletTxnType.LEAD_REFUND, status: WalletTxnStatus.SUCCESS, amount: refund, balanceAfter: balance, referenceId: lead.id, note: "Approved lead denial refund" },
        });
      }
      return tx.lead.update({ where: { id: lead.id }, data: { status: LeadStatus.DENIED, deniedAt: new Date() } });
    });
  }

  updateStartProof(id: string, approved: boolean) { return this.prisma.leadVisitProof.update({ where: { id }, data: { verified: approved, verifiedAt: new Date() }, include: { lead: true } }); }
  updateDenialProof(id: string, approved: boolean) { return this.prisma.leadDenialProof.update({ where: { id }, data: { approved, reviewedAt: new Date() }, include: { lead: true } }); }

  async refundLeadAcceptance(leadId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead?.assignedVendorId || !lead.leadAcceptanceCharge) return null;

      const existingRefund = await tx.walletTransaction.findFirst({
        where: { referenceId: leadId, type: WalletTxnType.LEAD_REFUND, status: WalletTxnStatus.SUCCESS },
      });
      if (existingRefund) return existingRefund;

      const wallet = await tx.wallet.findUnique({ where: { vendorId: lead.assignedVendorId } });
      if (!wallet) return null;

      const amount = lead.leadAcceptanceCharge;
      const balance = wallet.balance.add(amount);
      const spent = wallet.totalSpent.greaterThanOrEqualTo(amount) ? wallet.totalSpent.sub(amount) : wallet.totalSpent;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance, totalSpent: spent },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.LEAD_REFUND,
          status: WalletTxnStatus.SUCCESS,
          amount,
          balanceAfter: balance,
          referenceId: leadId,
          note: "Lead acceptance charge refunded after admin-approved denial.",
        },
      });
    });
  }

  pendingStartProofs(branchId?: string) {
    return this.prisma.leadVisitProof.findMany({
      where: {
        verified: false,
        lead: {
          status: LeadStatus.PENDING_START_VERIFICATION,
          ...(branchId ? { branchId } : {}),
        },
      },
      include: { lead: true, vendor: true },
      orderBy: { createdAt: "asc" },
    });
  }

  pendingDenialProofs(branchId?: string) {
    return this.prisma.leadDenialProof.findMany({
      where: {
        approved: null,
        lead: {
          status: LeadStatus.PENDING_DENIAL_VERIFICATION,
          ...(branchId ? { branchId } : {}),
        },
      },
      include: { lead: true, vendor: true },
      orderBy: { createdAt: "asc" },
    });
  }

  pendingVendors(where: Prisma.VendorWhereInput = {}) {
    return this.prisma.vendor.findMany({
      where: { profileStatus: VendorProfileStatus.UNDER_REVIEW, deletedAt: null, ...where },
      include: { kyc: true, bankDetail: true, branch: true },
      orderBy: { createdAt: "asc" },
    });
  }

  blockedTechnicians(where: Prisma.VendorWhereInput = {}) {
    return this.prisma.vendor.findMany({
      where: { role: VendorRole.TECHNICIAN, profileStatus: VendorProfileStatus.BLOCKED, deletedAt: null, ...where },
      include: { branch: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  complaintsForAdmin(where: Prisma.VendorComplaintWhereInput = {}) {
    return this.prisma.vendorComplaint.findMany({ where, include: { vendor: true }, orderBy: { createdAt: "asc" } });
  }

  countComplaints(where: Prisma.VendorComplaintWhereInput = {}) { return this.prisma.vendorComplaint.count({ where }); }

  wallet(vendorId: string) { return this.prisma.wallet.findUnique({ where: { vendorId } }); }

  async adjustWallet(vendorId: string, delta: Prisma.Decimal | number, type: WalletTxnType, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet) throw createHttpError(404, "Wallet not found.");
      const change = new Prisma.Decimal(delta);
      if (change.isZero()) throw createHttpError(400, "Amount must be non-zero.");
      const next = wallet.balance.plus(change);
      if (next.lt(0)) throw createHttpError(400, "Wallet balance cannot be negative.");
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: next } });
      return tx.walletTransaction.create({
        data: { walletId: wallet.id, type, status: WalletTxnStatus.SUCCESS, amount: change.abs(), balanceAfter: next, note },
      });
    });
  }

  async setWalletBalance(vendorId: string, amount: Prisma.Decimal | number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet) throw createHttpError(404, "Wallet not found.");
      const next = new Prisma.Decimal(amount);
      if (next.lt(0)) throw createHttpError(400, "Wallet balance cannot be negative.");
      const delta = next.minus(wallet.balance);
      if (delta.isZero()) throw createHttpError(409, "Wallet balance is already at the requested amount.");
      const type = delta.gte(0) ? WalletTxnType.ADMIN_CREDIT : WalletTxnType.ADMIN_DEBIT;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: next } });
      return tx.walletTransaction.create({
        data: { walletId: wallet.id, type, status: WalletTxnStatus.SUCCESS, amount: delta.abs(), balanceAfter: next, note: note ?? "Admin wallet balance update" },
      });
    });
  }

  findOrder(id: string) { return this.prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } }, payments: true, customer: true, branch: true } }); }
  listOrders(where: Prisma.OrderWhereInput, skip: number, take: number) { return this.prisma.order.findMany({ where, include: { items: { include: { product: true } }, payments: true, customer: true, branch: true }, skip, take, orderBy: { createdAt: "desc" } }); }
  countOrders(where: Prisma.OrderWhereInput) { return this.prisma.order.count({ where }); }
  updateOrder(id: string, data: { status?: OrderStatus; completionPhoto?: string }) { return this.prisma.order.update({ where: { id }, data }); }

  findPayment(id: string) { return this.prisma.payment.findUnique({ where: { id }, include: { order: true, lead: true, serviceRequest: true } }); }
  listPayments(where: Prisma.PaymentWhereInput, skip: number, take: number) { return this.prisma.payment.findMany({ where, include: { order: true, lead: true, serviceRequest: true }, skip, take, orderBy: { createdAt: "desc" } }); }
  updatePayment(id: string, data: { status: "PAID" | "FAILED"; transactionId?: string }) { return this.prisma.payment.update({ where: { id }, data }); }

  async prismaVerifyLeadPayment(paymentId: string, percentage: number) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || !payment.leadId || !payment.vendorId) throw createHttpError(404, "Lead payment not found.");
      if (payment.status === "PAID") {
        const commission = await tx.commission.findUnique({ where: { leadId: payment.leadId } });
        return { payment, lead: await tx.lead.findUnique({ where: { id: payment.leadId } }), commission };
      }
      const updatedPayment = await tx.payment.update({ where: { id: paymentId }, data: { status: "PAID", transactionId: `DEMO-${payment.id}` } });
      const lead = await tx.lead.update({ where: { id: payment.leadId }, data: { status: LeadStatus.COMPLETED, completedAt: new Date() } });
      const commissionAmount = payment.amount.mul(percentage).div(100);
      const commission = await tx.commission.upsert({
        where: { leadId: lead.id },
        update: {},
        create: { leadId: lead.id, vendorId: payment.vendorId, amount: commissionAmount, percentage, status: "PENDING" },
      });
      return { payment: updatedPayment, lead, commission };
    });
  }

  notifyVendor(vendorId: string, title: string, message: string, type: string) {
    return this.prisma.notification.create({ data: { vendorId, title, message, type } });
  }

  async creditCommission(commissionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findUnique({ where: { id: commissionId } });
      if (!commission || commission.status === "CREDITED") return commission;
      const wallet = await tx.wallet.findUnique({ where: { vendorId: commission.vendorId } });
      if (!wallet) throw createHttpError(404, "Vendor wallet not found.");
      const balance = wallet.balance.plus(commission.amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance, totalEarned: wallet.totalEarned.plus(commission.amount) } });
      const transaction = await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: WalletTxnType.COMMISSION_CREDIT, status: WalletTxnStatus.SUCCESS, amount: commission.amount, balanceAfter: balance, referenceId: commission.id, note: "Lead completion commission" },
      });
      const offer = await tx.offer.findFirst({ where: { isActive: true, type: "CASHBACK" }, orderBy: { createdAt: "asc" } });
      if (offer) await tx.offerReward.create({ data: { offerId: offer.id, vendorId: commission.vendorId } });
      return tx.commission.update({ where: { id: commission.id }, data: { status: "CREDITED", transactionId: transaction.id } });
    });
  }

  listProducts(where: Prisma.ProductWhereInput, skip: number, take: number) { return this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }); }
  countProducts(where: Prisma.ProductWhereInput) { return this.prisma.product.count({ where }); }
  createProduct(data: Prisma.ProductUncheckedCreateInput) { return this.prisma.product.create({ data }); }
  updateProduct(id: string, data: Prisma.ProductUncheckedUpdateInput) { return this.prisma.product.update({ where: { id }, data }); }
  deleteProduct(id: string) { return this.prisma.product.update({ where: { id }, data: { isActive: false } }); }

  listServices(where: Prisma.ServiceWhereInput, skip: number, take: number) { return this.prisma.service.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }); }
  countServices(where: Prisma.ServiceWhereInput) { return this.prisma.service.count({ where }); }
  createService(data: Prisma.ServiceUncheckedCreateInput) { return this.prisma.service.create({ data }); }
  updateService(id: string, data: Prisma.ServiceUncheckedUpdateInput) { return this.prisma.service.update({ where: { id }, data }); }
  deleteService(id: string) { return this.prisma.service.update({ where: { id }, data: { isActive: false } }); }

  findComplaint(id: string) { return this.prisma.vendorComplaint.findUnique({ where: { id }, include: { vendor: true } }); }

  listComplaints(where: Prisma.VendorComplaintWhereInput, skip: number, take: number) { return this.prisma.vendorComplaint.findMany({ where, include: { vendor: true }, skip, take, orderBy: { createdAt: "asc" } }); }
  updateComplaint(id: string, data: Prisma.VendorComplaintUpdateInput) { return this.prisma.vendorComplaint.update({ where: { id }, data }); }

  findBranch(id: string) { return this.prisma.branch.findUnique({ where: { id } }); }

  listBranches(skip: number, take: number) { return this.prisma.branch.findMany({ include: { admins: { include: { user: true } }, _count: { select: { vendors: true, products: true, services: true, leads: true, orders: true } } }, skip, take, orderBy: { name: "asc" } }); }
  countBranches() { return this.prisma.branch.count(); }
  createBranch(data: Prisma.BranchUncheckedCreateInput) { return this.prisma.branch.create({ data }); }
  updateBranch(id: string, data: Prisma.BranchUncheckedUpdateInput) { return this.prisma.branch.update({ where: { id }, data }); }

  listSettings() { return this.prisma.systemSetting.findMany({ orderBy: { key: "asc" } }); }
  upsertSetting(key: string, value: Prisma.InputJsonValue, description?: string) { return this.prisma.systemSetting.upsert({ where: { key }, update: { value, description }, create: { key, value, description } }); }

  async paymentSummary(branchId?: string) {
    const where: Prisma.PaymentWhereInput = branchId
      ? { OR: [{ order: { branchId } }, { lead: { branchId } }, { serviceRequest: { branchId } }] }
      : {};
    const [paid, pending, failed] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.count({ where: { ...where, status: "PENDING" } }),
      this.prisma.payment.count({ where: { ...where, status: "FAILED" } }),
    ]);
    return { paidAmount: paid._sum.amount, paidCount: paid._count._all, pendingCount: pending, failedCount: failed };
  }

  async dashboard(branchId?: string) {
    const vendorWhere: Prisma.VendorWhereInput = branchId ? { branchId } : {};
    const leadWhere: Prisma.LeadWhereInput = branchId ? { branchId } : {};
    const orderWhere: Prisma.OrderWhereInput = branchId ? { branchId } : {};
    const productWhere: Prisma.ProductWhereInput = branchId ? { branchId } : {};
    const serviceWhere: Prisma.ServiceWhereInput = branchId ? { branchId } : {};
    const complaintWhere: Prisma.VendorComplaintWhereInput = branchId ? { vendor: { branchId } } : {};
    const [vendors, leads, orders, products, services, complaints] = await Promise.all([
      this.prisma.vendor.count({ where: vendorWhere }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.service.count({ where: serviceWhere }),
      this.prisma.vendorComplaint.count({ where: complaintWhere }),
    ]);
    return { vendors, leads, orders, products, services, complaints };
  }
}
