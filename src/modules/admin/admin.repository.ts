import createHttpError from "http-errors";
import { injectable, inject } from "tsyringe";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  LeadStatus,
  ServiceRequestStatus,
  OrderStatus,
  Role,
  VendorProfileStatus,
  VendorVerificationStatus,
  VendorRole,
  WalletTxnStatus,
  WalletTxnType,
} from "../../generated/prisma/enums";

@injectable()
export class AdminRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  listUsers(skip: number, take: number) {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        rank: true,
        pv: true,
        bv: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        adminProfile: { include: { branch: true } },
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countUsers() {
    return this.prisma.user.count({ where: { deletedAt: null } });
  }

  listAdmins(skip: number, take: number) {
    return this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        adminProfile: { include: { branch: true } },
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countAdmins() {
    return this.prisma.user.count({
      where: { role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null },
    });
  }

  countSuperAdmins() {
    return this.prisma.user.count({
      where: { role: Role.SADMIN, deletedAt: null },
    });
  }

  async updateAdmin(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string | null;
      isActive?: boolean;
      updatedBy?: string;
      adminProfile?: { update: { branchId?: string | null; jobTitle?: string | null } };
    }
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  async ensureAdminProfile(
    userId: string,
    data: { branchId?: string | null; jobTitle?: string | null }
  ) {
    return this.prisma.adminProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      include: { branch: true },
    });
  }

  findAdminById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, role: { in: [Role.ADMIN, Role.SADMIN] }, deletedAt: null },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  async updateUserRole(id: string, role: Role, updatedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role, updatedBy },
      });

      if (role === Role.ADMIN || role === Role.SADMIN) {
        await tx.adminProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id },
        });
      } else {
        await tx.adminProfile.deleteMany({ where: { userId: id } });
      }

      return tx.user.findUnique({
        where: { id },
        include: { adminProfile: { include: { branch: true } } },
      });
    });
  }

  async resetAdminPassword(id: string, password: string, updatedBy: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password, updatedBy },
      select: { id: true, email: true, role: true, updatedAt: true },
    });
  }

  async listAuditLogs(args: {
    skip: number;
    take: number;
    actorId?: string;
    action?: string;
    entityType?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(args.actorId ? { actorId: args.actorId } : {}),
      ...(args.action ? { action: { contains: args.action, mode: "insensitive" } } : {}),
      ...(args.entityType ? { entityType: args.entityType } : {}),
      ...(args.from || args.to
        ? {
            createdAt: {
              ...(args.from ? { gte: args.from } : {}),
              ...(args.to ? { lte: args.to } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }

  createAuditLog(data: {
    actorType: string;
    actorId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  updateUser(id: string, data: { isActive?: boolean; role?: Role; updatedBy?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  createAdmin(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    branchId?: string;
    jobTitle?: string;
  }) {
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

  createVendor(data: {
    vendorCode: string;
    role: VendorRole;
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    specialization?: string;
    experienceYears?: number;
    skills?: string[];
    branchId?: string;
    verificationStatus?: VendorVerificationStatus;
    profileStatus?: VendorProfileStatus;
    referralCode?: string;
  }) {
    return this.prisma.vendor.create({
      data: {
        ...data,
        wallet: { create: {} },
      },
      include: { branch: true, wallet: true },
    });
  }

  findVendorByPhone(phone: string) {
    return this.prisma.vendor.findUnique({ where: { phone } });
  }

  findVendorByEmail(email: string) {
    return this.prisma.vendor.findUnique({ where: { email } });
  }

  listVendors(where: Prisma.VendorWhereInput, skip: number, take: number) {
    return this.prisma.vendor.findMany({
      where,
      include: { kyc: true, bankDetail: true, branch: true, wallet: true },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countVendors(where: Prisma.VendorWhereInput) {
    return this.prisma.vendor.count({ where });
  }

  findVendor(id: string) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: { kyc: true, bankDetail: true, branch: true, wallet: true },
    });
  }

  updateVendor(
    id: string,
    data: {
      verificationStatus?: VendorVerificationStatus;
      profileStatus?: VendorProfileStatus;
      rejectionReason?: string | null;
      branchId?: string | null;
      district?: string;
      specialization?: string;
    }
  ) {
    return this.prisma.vendor.update({
      where: { id },
      data,
      include: { branch: true, wallet: true },
    });
  }

  findMatchingTechnicians(criteria: {
    specialization?: string | null;
    district?: string | null;
    pincode?: string | null;
    branchId?: string | null;
  }) {
    const where: Prisma.VendorWhereInput = {
      role: VendorRole.TECHNICIAN,
      deletedAt: null,
      verificationStatus: VendorVerificationStatus.VERIFIED,
      profileStatus: VendorProfileStatus.PUBLISHED,
    };

    const conditions: Prisma.VendorWhereInput[] = [];

    if (criteria.specialization) {
      conditions.push({ specialization: criteria.specialization });
    }

    const locationConditions: Prisma.VendorWhereInput[] = [];
    if (criteria.district) {
      locationConditions.push({ district: { equals: criteria.district, mode: "insensitive" } });
      locationConditions.push({ city: { equals: criteria.district, mode: "insensitive" } });
    }
    if (criteria.pincode) {
      locationConditions.push({ pincode: criteria.pincode });
    }
    if (criteria.branchId) {
      locationConditions.push({ branchId: criteria.branchId });
    }

    if (locationConditions.length > 0) {
      conditions.push({ OR: locationConditions });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    return this.prisma.vendor.findMany({
      where,
      select: { id: true, fullName: true, phone: true, email: true, specialization: true, district: true, pincode: true },
    });
  }

  listLeads(where: Prisma.LeadWhereInput, skip: number, take: number) {
    return this.prisma.lead.findMany({
      where,
      include: {
        assignedVendor: true,
        product: true,
        service: true,
        visitProofs: true,
        denialProofs: true,
        payments: true,
        branch: true,
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countLeads(where: Prisma.LeadWhereInput) {
    return this.prisma.lead.count({ where });
  }

  findLead(id: string) {
    return this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedVendor: true,
        product: true,
        service: true,
        visitProofs: true,
        denialProofs: true,
        payments: true,
        branch: true,
      },
    });
  }

  createLead(data: Prisma.LeadUncheckedCreateInput) {
    return this.prisma.lead.create({
      data,
      include: { branch: true, service: true, product: true },
    });
  }

  updateLead(id: string, data: Prisma.LeadUncheckedUpdateInput) {
    return this.prisma.lead.update({
      where: { id },
      data,
      include: { branch: true, service: true, product: true, assignedVendor: true },
    });
  }

  updateLeadStatus(id: string, status: LeadStatus) {
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }

  findStartProof(id: string) {
    return this.prisma.leadVisitProof.findUnique({
      where: { id },
      include: { lead: true, vendor: true },
    });
  }

  findDenialProof(id: string) {
    return this.prisma.leadDenialProof.findUnique({
      where: { id },
      include: { lead: true, vendor: true },
    });
  }

  async reviewStartProof(id: string, approved: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const proof = await tx.leadVisitProof.findUnique({ where: { id } });
      if (!proof) throw createHttpError(404, "Start proof not found.");
      await tx.leadVisitProof.update({
        where: { id },
        data: { verified: approved, verifiedAt: new Date() },
      });
      const updated = await tx.lead.update({
        where: { id: proof.leadId },
        data: {
          status: approved ? LeadStatus.ONGOING : LeadStatus.ACCEPTED,
          ...(approved ? { startVerifiedAt: new Date() } : {}),
        },
      });
      if (updated.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updated.serviceRequestId },
          data: {
            status: approved ? ServiceRequestStatus.ONGOING : ServiceRequestStatus.ACCEPTED,
          },
        });
      }
      return updated;
    });
  }

  async reviewDenialProof(
    id: string,
    approved: boolean,
    opts?: { refundAmount?: number; reason?: string; note?: string }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const proof = await tx.leadDenialProof.findUnique({
        where: { id },
        include: { lead: true, vendor: true },
      });
      if (!proof) throw createHttpError(404, "Denial proof not found.");

      await tx.leadDenialProof.update({
        where: { id },
        data: { approved, reviewedAt: new Date() },
      });

      const lead = await tx.lead.findUnique({ where: { id: proof.leadId } });
      if (!lead) throw createHttpError(404, "Lead not found.");

      if (!approved) {
        const updated = await tx.lead.update({
          where: { id: lead.id },
          data: { status: LeadStatus.ACCEPTED },
        });

        // Notify vendor of rejection
        await tx.notification.create({
          data: {
            vendorId: proof.vendorId,
            title: "Lead Denial Proof Rejected",
            message: `Your denial proof for lead ${lead.customerName || lead.id} was not approved by Admin. ${opts?.reason ? `Reason: ${opts.reason}` : "Please continue servicing the lead or contact support."}`,
            type: "LEAD_DENIAL_REJECTED",
          },
        });

        return { lead: updated, approved: false, refunded: false, refundAmount: 0 };
      }

      const targetVendorId = lead.assignedVendorId || proof.vendorId;
      if (!targetVendorId) throw createHttpError(409, "Lead has no assigned vendor.");

      let wallet = await tx.wallet.findUnique({ where: { vendorId: targetVendorId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { vendorId: targetVendorId, balance: new Prisma.Decimal(0) },
        });
      }

      // Calculate refund amount
      const refund =
        opts?.refundAmount !== undefined
          ? new Prisma.Decimal(opts.refundAmount)
          : (lead.leadAcceptPrice ?? lead.leadAcceptanceCharge ?? new Prisma.Decimal(0));

      let newBalance = wallet.balance;
      if (refund.gt(0)) {
        newBalance = wallet.balance.plus(refund);
        const newTotalSpent = wallet.totalSpent.gte(refund)
          ? wallet.totalSpent.minus(refund)
          : new Prisma.Decimal(0);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance, totalSpent: newTotalSpent },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTxnType.LEAD_REFUND,
            status: WalletTxnStatus.SUCCESS,
            amount: refund,
            balanceAfter: newBalance,
            referenceId: lead.id,
            note: opts?.note || `Coins refunded for verified denial proof on lead #${lead.id.slice(0, 8)}`,
          },
        });

        await tx.notification.create({
          data: {
            vendorId: targetVendorId,
            title: "Denial Verified - Coins Refunded! 💰",
            message: `Your denial proof for lead ${lead.customerName || lead.id} has been verified by Admin. ₹${refund.toString()} coins have been refunded to your wallet.`,
            type: "LEAD_REFUND",
          },
        });
      }

      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.DENIED, deniedAt: new Date() },
      });

      if (updated.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updated.serviceRequestId },
          data: { status: ServiceRequestStatus.DENIED, deniedAt: new Date() },
        });
      }

      return {
        lead: updated,
        approved: true,
        refunded: refund.gt(0),
        refundAmount: refund.toNumber(),
        vendorWalletBalance: newBalance.toNumber(),
      };
    });
  }

  async refundLead(
    leadId: string,
    opts?: { amount?: number; note?: string }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw createHttpError(404, "Lead not found.");
      if (!lead.assignedVendorId) throw createHttpError(409, "Lead has no assigned vendor to refund.");

      let wallet = await tx.wallet.findUnique({ where: { vendorId: lead.assignedVendorId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { vendorId: lead.assignedVendorId, balance: new Prisma.Decimal(0) },
        });
      }

      const refund =
        opts?.amount !== undefined
          ? new Prisma.Decimal(opts.amount)
          : (lead.leadAcceptPrice ?? lead.leadAcceptanceCharge ?? new Prisma.Decimal(0));

      if (refund.lte(0)) {
        throw createHttpError(400, "Refund amount must be greater than 0.");
      }

      const newBalance = wallet.balance.plus(refund);
      const newTotalSpent = wallet.totalSpent.gte(refund)
        ? wallet.totalSpent.minus(refund)
        : new Prisma.Decimal(0);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance, totalSpent: newTotalSpent },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.LEAD_REFUND,
          status: WalletTxnStatus.SUCCESS,
          amount: refund,
          balanceAfter: newBalance,
          referenceId: lead.id,
          note: opts?.note || `Direct admin refund for lead #${lead.id.slice(0, 8)}`,
        },
      });

      await tx.notification.create({
        data: {
          vendorId: lead.assignedVendorId,
          title: "Lead Coins Refunded! 💰",
          message: `Admin refunded ₹${refund.toString()} coins to your wallet for lead ${lead.customerName || lead.id}.`,
          type: "LEAD_REFUND",
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.DENIED, deniedAt: new Date() },
      });

      if (updatedLead.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updatedLead.serviceRequestId },
          data: { status: ServiceRequestStatus.DENIED, deniedAt: new Date() },
        });
      }

      return {
        leadId: updatedLead.id,
        status: updatedLead.status,
        vendorId: lead.assignedVendorId,
        refundAmount: refund.toNumber(),
        vendorWalletBalance: newBalance.toNumber(),
      };
    });
  }

  pendingStartProofs(branchId?: string) {
    const where: Prisma.LeadVisitProofWhereInput = { verified: false };
    if (branchId) where.lead = { branchId };
    return this.prisma.leadVisitProof.findMany({
      where,
      include: { lead: true, vendor: true },
      orderBy: { capturedAt: "desc" },
    });
  }

  pendingDenialProofs(branchId?: string) {
    const where: Prisma.LeadDenialProofWhereInput = { approved: null };
    if (branchId) where.lead = { branchId };
    return this.prisma.leadDenialProof.findMany({
      where,
      include: { lead: true, vendor: true },
      orderBy: { capturedAt: "desc" },
    });
  }

  pendingVendors(where: Prisma.VendorWhereInput) {
    return this.prisma.vendor.findMany({
      where: { ...where, verificationStatus: VendorVerificationStatus.PENDING, deletedAt: null },
      include: { kyc: true, bankDetail: true, branch: true },
      orderBy: { createdAt: "asc" },
    });
  }

  blockedTechnicians(where: Prisma.VendorWhereInput) {
    return this.prisma.vendor.findMany({
      where: { ...where, profileStatus: VendorProfileStatus.BLOCKED, deletedAt: null },
      include: { kyc: true, bankDetail: true, branch: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async setWalletBalance(vendorId: string, balance: number, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet) throw createHttpError(404, "Vendor wallet not found.");
      const next = new Prisma.Decimal(balance);
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: next } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.ADMIN_CREDIT,
          status: WalletTxnStatus.SUCCESS,
          amount: next.minus(wallet.balance),
          balanceAfter: next,
          note: note || "Admin wallet balance update",
        },
      });
      return updated;
    });
  }

  async adjustWallet(vendorId: string, amount: number, type: WalletTxnType, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { vendorId } });
      if (!wallet) throw createHttpError(404, "Vendor wallet not found.");
      const delta = new Prisma.Decimal(amount);
      const balance = wallet.balance.plus(delta);
      if (balance.isNegative()) throw createHttpError(400, "Wallet balance cannot be negative.");

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance,
          ...(delta.isPositive()
            ? { totalEarned: wallet.totalEarned.plus(delta) }
            : { totalSpent: wallet.totalSpent.plus(delta.abs()) }),
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          status: WalletTxnStatus.SUCCESS,
          amount: delta.abs(),
          balanceAfter: balance,
          note,
        },
      });

      return { wallet: updated, transaction };
    });
  }

  listWalletTransactions(where: Prisma.WalletTransactionWhereInput = {}, skip = 0, take = 200) {
    return this.prisma.walletTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        wallet: {
          include: {
            vendor: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                vendorCode: true,
              },
            },
          },
        },
      },
    });
  }

  listPayments(where: Prisma.PaymentWhereInput, skip: number, take: number) {
    return this.prisma.payment.findMany({
      where,
      include: { order: true, serviceRequest: true, lead: true, vendor: true },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countPayments(where: Prisma.PaymentWhereInput) {
    return this.prisma.payment.count({ where });
  }

  findPayment(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { order: true, lead: true, serviceRequest: true, vendor: true },
    });
  }

  updatePayment(id: string, data: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({ where: { id }, data });
  }

  countComplaints(where: Prisma.VendorComplaintWhereInput) {
    return this.prisma.vendorComplaint.count({ where });
  }

  async confirmPayment(paymentId: string, percentage: Prisma.Decimal) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || !payment.leadId || !payment.vendorId) {
        throw createHttpError(404, "Lead payment not found.");
      }
      if (payment.status === "PAID") {
        const commission = await tx.commission.findUnique({ where: { leadId: payment.leadId } });
        return { payment, lead: await tx.lead.findUnique({ where: { id: payment.leadId } }), commission };
      }
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "PAID", transactionId: `DEMO-${payment.id}` },
      });
      const lead = await tx.lead.update({
        where: { id: payment.leadId },
        data: { status: LeadStatus.COMPLETED, completedAt: new Date() },
      });
      const commissionAmount = payment.amount.mul(percentage).div(100);
      const commission = await tx.commission.upsert({
        where: { leadId: lead.id },
        update: {},
        create: {
          leadId: lead.id,
          vendorId: payment.vendorId,
          amount: commissionAmount,
          percentage,
          status: "PENDING",
        },
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
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance, totalEarned: wallet.totalEarned.plus(commission.amount) },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.COMMISSION_CREDIT,
          status: WalletTxnStatus.SUCCESS,
          amount: commission.amount,
          balanceAfter: balance,
          referenceId: commission.id,
          note: "Lead completion commission",
        },
      });
      return tx.commission.update({
        where: { id: commission.id },
        data: { status: "CREDITED", transactionId: transaction.id },
      });
    });
  }

  listProducts(where: Prisma.ProductWhereInput, skip: number, take: number) {
    return this.prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { dynamicCategory: true },
    });
  }

  countProducts(where: Prisma.ProductWhereInput) {
    return this.prisma.product.count({ where });
  }

  createProduct(data: Prisma.ProductUncheckedCreateInput) {
    return this.prisma.product.create({ data });
  }

  updateProduct(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  deleteProduct(id: string) {
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  listServices(where: Prisma.ServiceWhereInput, skip: number, take: number) {
    return this.prisma.service.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { dynamicCategory: true },
    });
  }

  countServices(where: Prisma.ServiceWhereInput) {
    return this.prisma.service.count({ where });
  }

  createService(data: Prisma.ServiceUncheckedCreateInput) {
    return this.prisma.service.create({ data });
  }

  updateService(id: string, data: Prisma.ServiceUncheckedUpdateInput) {
    return this.prisma.service.update({ where: { id }, data });
  }

  deleteService(id: string) {
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }

  findComplaint(id: string) {
    return this.prisma.vendorComplaint.findUnique({
      where: { id },
      include: { vendor: true },
    });
  }

  listComplaints(where: Prisma.VendorComplaintWhereInput, skip: number, take: number) {
    return this.prisma.vendorComplaint.findMany({
      where,
      include: { vendor: true },
      skip,
      take,
      orderBy: { createdAt: "asc" },
    });
  }

  updateComplaint(id: string, data: Prisma.VendorComplaintUpdateInput) {
    return this.prisma.vendorComplaint.update({ where: { id }, data });
  }

  findBranch(id: string) {
    return this.prisma.branch.findUnique({ where: { id } });
  }

  listBranches(skip: number, take: number) {
    return this.prisma.branch.findMany({
      include: {
        admins: { include: { user: true } },
        _count: {
          select: {
            vendors: true,
            products: true,
            services: true,
            leads: true,
            orders: true,
          },
        },
      },
      skip,
      take,
      orderBy: { name: "asc" },
    });
  }

  countBranches() {
    return this.prisma.branch.count();
  }

  createBranch(data: Prisma.BranchUncheckedCreateInput) {
    return this.prisma.branch.create({ data });
  }

  updateBranch(id: string, data: Prisma.BranchUncheckedUpdateInput) {
    return this.prisma.branch.update({ where: { id }, data });
  }

  listSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  }

  upsertSetting(key: string, value: Prisma.InputJsonValue, description?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }

  async paymentSummary(branchId?: string) {
    const where: Prisma.PaymentWhereInput = branchId
      ? { OR: [{ order: { branchId } }, { lead: { branchId } }, { serviceRequest: { branchId } }] }
      : {};
    const [paid, pending, failed] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...where, status: "PAID" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.count({ where: { ...where, status: "PENDING" } }),
      this.prisma.payment.count({ where: { ...where, status: "FAILED" } }),
    ]);
    return {
      paidAmount: paid._sum.amount,
      paidCount: paid._count._all,
      pendingCount: pending,
      failedCount: failed,
    };
  }

  async dashboard(branchId?: string) {
    const vendorWhere: Prisma.VendorWhereInput = branchId ? { branchId } : {};
    const technicianWhere: Prisma.VendorWhereInput = {
      ...vendorWhere,
      role: VendorRole.TECHNICIAN,
      deletedAt: null,
    };
    const activeTechnicianWhere: Prisma.VendorWhereInput = {
      ...technicianWhere,
      profileStatus: VendorProfileStatus.PUBLISHED,
    };
    const leadWhere: Prisma.LeadWhereInput = branchId ? { branchId } : {};
    const orderWhere: Prisma.OrderWhereInput = branchId ? { branchId } : {};
    const productWhere: Prisma.ProductWhereInput = branchId ? { branchId } : {};
    const serviceWhere: Prisma.ServiceWhereInput = branchId ? { branchId } : {};
    const complaintWhere: Prisma.VendorComplaintWhereInput = branchId ? { vendor: { branchId } } : {};
    const [
      vendors,
      technicians,
      activeTechnicians,
      leads,
      orders,
      products,
      services,
      complaints,
    ] = await Promise.all([
      this.prisma.vendor.count({ where: vendorWhere }),
      this.prisma.vendor.count({ where: technicianWhere }),
      this.prisma.vendor.count({ where: activeTechnicianWhere }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.service.count({ where: serviceWhere }),
      this.prisma.vendorComplaint.count({ where: complaintWhere }),
    ]);
    return {
      vendors,
      technicians,
      activeTechnicians,
      activeVendors: technicians,
      leads,
      orders,
      products,
      services,
      complaints,
    };
  }

  listAdminNotifications(
    where: Prisma.NotificationWhereInput,
    skip = 0,
    take = 20
  ) {
    return this.prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  countAdminNotifications(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.count({ where });
  }

  markNotificationAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  markAllNotificationsAsRead(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  deleteNotification(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  clearReadNotifications(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.deleteMany({
      where: {
        ...where,
        isRead: true,
      },
    });
  }

  async notifyAllAdmins(title: string, message: string, type: string, branchId?: string) {
    const adminWhere: Prisma.UserWhereInput = {
      role: { in: [Role.ADMIN, Role.SADMIN] },
      isActive: true,
      deletedAt: null,
      ...(branchId ? { adminProfile: { branchId } } : {}),
    };
    const admins = await this.prisma.user.findMany({
      where: adminWhere,
      select: { id: true },
    });

    if (admins.length > 0) {
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title,
          message,
          type,
        })),
      });
    }
  }

  async notifyAllVendors(title: string, message: string, type: string, branchId?: string) {
    const vendorWhere: Prisma.VendorWhereInput = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
    };
    const vendors = await this.prisma.vendor.findMany({
      where: vendorWhere,
      select: { id: true },
    });

    if (vendors.length > 0) {
      await this.prisma.notification.createMany({
        data: vendors.map((v) => ({
          vendorId: v.id,
          title,
          message,
          type,
        })),
      });
    }
  }

  async notifyAllCustomers(title: string, message: string, type: string) {
    const customers = await this.prisma.user.findMany({
      where: { role: Role.CLIENT, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (customers.length > 0) {
      await this.prisma.notification.createMany({
        data: customers.map((c) => ({
          userId: c.id,
          title,
          message,
          type,
        })),
      });
    }
  }

  listCategories(where: Prisma.CategoryWhereInput, skip = 0, take = 50) {
    return this.prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            products: true,
            services: true,
          },
        },
      },
    });
  }

  countCategories(where: Prisma.CategoryWhereInput) {
    return this.prisma.category.count({ where });
  }

  findCategory(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            services: true,
          },
        },
      },
    });
  }

  createCategory(data: Prisma.CategoryCreateInput) {
    return this.prisma.category.create({
      data,
    });
  }

  updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  deleteCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
