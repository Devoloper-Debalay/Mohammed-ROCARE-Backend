import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import createHttpError from "http-errors";
import { AdminService } from "./admin.service";
import { sendSuccess } from "../../shared/response";

import { OrderService } from "../orders/order.service";

function adminId(res: Response): string {
  const id = res.locals.adminId as string | undefined;
  if (!id) throw createHttpError(401, "Unauthenticated admin request.");
  return id;
}

function extractUploadedBuffers(req: Request): Buffer[] {
  const buffers: Buffer[] = [];
  if (req.file?.buffer) {
    buffers.push(req.file.buffer);
  }
  if (Array.isArray(req.files)) {
    for (const f of req.files) {
      if (f?.buffer) buffers.push(f.buffer);
    }
  } else if (req.files && typeof req.files === "object") {
    for (const key of Object.keys(req.files)) {
      const arr = (req.files as Record<string, Express.Multer.File[]>)[key];
      if (Array.isArray(arr)) {
        for (const f of arr) {
          if (f?.buffer) buffers.push(f.buffer);
        }
      }
    }
  }
  return buffers;
}

@injectable()
export class AdminController {
  constructor(
    @inject(AdminService) private readonly service: AdminService,
    @inject(OrderService) private readonly orderService: OrderService
  ) {}

  orders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.orderService.adminList(req.query as any),
        "Orders fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  updateOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.orderService.adminStatus(
          req.params.orderId as string,
          req.body.status
        ),
        "Order status updated."
      );
    } catch (e) {
      next(e);
    }
  };

  me = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.context(adminId(res)), "Admin context fetched.");
    } catch (e) {
      next(e);
    }
  };

  createVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createVendor(adminId(res), req.body),
        "Vendor created successfully.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  pendingStartProofs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.pendingStartProofs(adminId(res)),
        "Pending start proofs fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  pendingDenialProofs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.pendingDenialProofs(adminId(res)),
        "Pending denial proofs fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  pendingVendors = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.pendingVendors(adminId(res)), "Pending vendors fetched.");
    } catch (e) {
      next(e);
    }
  };

  blockedTechnicians = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.blockedTechnicians(adminId(res)),
        "Blocked technicians fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  vendors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.vendors(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Vendors fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  verifyVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.verifyVendor(
          adminId(res),
          req.params.vendorId as string,
          req.body.approved,
          req.body.reason
        ),
        "Vendor verification updated."
      );
    } catch (e) {
      next(e);
    }
  };

  publishVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.publishVendor(adminId(res), req.params.vendorId as string),
        "Vendor published."
      );
    } catch (e) {
      next(e);
    }
  };

  unblockVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.unblockVendor(adminId(res), req.params.vendorId as string),
        "Vendor unblocked."
      );
    } catch (e) {
      next(e);
    }
  };

  assignVendorBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.assignVendorBranch(
          adminId(res),
          req.params.vendorId as string,
          req.body.branchId
        ),
        "Vendor branch updated."
      );
    } catch (e) {
      next(e);
    }
  };

  createLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createLead(adminId(res), req.body),
        "Lead created successfully.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  priceAndReleaseLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.priceAndReleaseLead(
          adminId(res),
          req.params.leadId as string,
          req.body
        ),
        "Lead priced and released to local technicians successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  lead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.getLead(adminId(res), req.params.leadId as string),
        "Lead details fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  updateLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateLead(adminId(res), req.params.leadId as string, req.body),
        "Lead updated successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  leads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.leads(adminId(res), {
          page: Number(req.query.page ?? 1),
          limit: Number(req.query.limit ?? 20),
          isReleased:
            req.query.isReleased !== undefined ? req.query.isReleased === "true" : undefined,
          district: req.query.district as string,
          pincode: req.query.pincode as string,
          specialization: req.query.specialization as string,
          status: req.query.status as string,
          branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
        }),
        "Leads fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  reviewStart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.reviewStartProof(
          adminId(res),
          req.params.proofId as string,
          req.body.approved
        ),
        "Start proof reviewed."
      );
    } catch (e) {
      next(e);
    }
  };

  reviewDenial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.reviewDenialProof(
          adminId(res),
          req.params.proofId as string,
          req.body.approved,
          {
            refundAmount:
              req.body.refundAmount !== undefined ? Number(req.body.refundAmount) : undefined,
            reason: req.body.reason,
            note: req.body.note,
          }
        ),
        "Denial proof reviewed successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  refundLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.refundLead(
          adminId(res),
          req.params.leadId as string,
          {
            amount: req.body.amount !== undefined ? Number(req.body.amount) : undefined,
            note: req.body.note,
          }
        ),
        "Lead coins refunded to vendor wallet successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  walletCredit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.walletCredit(
          adminId(res),
          req.body.vendorId,
          req.body.amount,
          req.body.note
        ),
        "Wallet credited."
      );
    } catch (e) {
      next(e);
    }
  };

  walletDebit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.walletDebit(
          adminId(res),
          req.body.vendorId,
          req.body.amount,
          req.body.note
        ),
        "Wallet debited."
      );
    } catch (e) {
      next(e);
    }
  };

  walletUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.walletUpdate(
          adminId(res),
          req.body.vendorId,
          req.body.amount,
          req.body.note
        ),
        "Wallet updated."
      );
    } catch (e) {
      next(e);
    }
  };

  walletTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 200);
      sendSuccess(
        res,
        await this.service.walletTransactions(adminId(res), page, limit),
        "Wallet transactions retrieved successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  payments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.payments(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Payments fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.confirmPayment(
          adminId(res),
          req.params.paymentId as string,
          req.body.approved,
          req.body.transactionId
        ),
        "Payment reviewed."
      );
    } catch (e) {
      next(e);
    }
  };

  products = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.products(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Products fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  product = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.product(adminId(res), req.params.productId as string),
        "Product fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(
        res,
        await this.service.createProduct(adminId(res), req.body, imageBuffers),
        "Product created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(
        res,
        await this.service.updateProduct(adminId(res), req.params.productId as string, req.body, imageBuffers),
        "Product updated."
      );
    } catch (e) {
      next(e);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.deleteProduct(adminId(res), req.params.productId as string),
        "Product deleted."
      );
    } catch (e) {
      next(e);
    }
  };

  uploadProductImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffers = extractUploadedBuffers(req);
      if (buffers.length === 0) throw createHttpError(400, "Image file is required.");
      const url = await this.service.uploadProductImage(buffers[0]);
      sendSuccess(res, { url }, "Product image uploaded.", 201);
    } catch (e) {
      next(e);
    }
  };

  parts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.parts(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Parts fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  part = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.part(adminId(res), req.params.partId as string),
        "Part fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  createPart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(
        res,
        await this.service.createPart(adminId(res), req.body, imageBuffers),
        "Part created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  updatePart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(
        res,
        await this.service.updatePart(adminId(res), req.params.partId as string, req.body, imageBuffers),
        "Part updated."
      );
    } catch (e) {
      next(e);
    }
  };

  deletePart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.deletePart(adminId(res), req.params.partId as string),
        "Part deleted."
      );
    } catch (e) {
      next(e);
    }
  };

  uploadPartImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffers = extractUploadedBuffers(req);
      if (buffers.length === 0) throw createHttpError(400, "Image file is required.");
      const url = await this.service.uploadPartImage(buffers[0]);
      sendSuccess(res, { url }, "Part image uploaded.", 201);
    } catch (e) {
      next(e);
    }
  };

  services = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.services(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Services fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createService(adminId(res), req.body),
        "Service created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateService(adminId(res), req.params.serviceId as string, req.body),
        "Service updated."
      );
    } catch (e) {
      next(e);
    }
  };

  categories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const type = req.query.type as any;
      const search = req.query.search as string | undefined;
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      sendSuccess(
        res,
        await this.service.categories(adminId(res), {
          page,
          limit,
          type,
          search,
          isActive,
        }),
        "Categories fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  category = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.category(adminId(res), req.params.categoryId as string),
        "Category fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createCategory(adminId(res), req.body),
        "Category created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateCategory(
          adminId(res),
          req.params.categoryId as string,
          req.body
        ),
        "Category updated."
      );
    } catch (e) {
      next(e);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.deleteCategory(adminId(res), req.params.categoryId as string),
        "Category deleted."
      );
    } catch (e) {
      next(e);
    }
  };

  complaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.adminComplaints(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Complaints fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  replyComplaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.adminComplaintReply(
          adminId(res),
          req.params.complaintId as string,
          req.body.reply,
          req.body.status
        ),
        "Complaint updated."
      );
    } catch (e) {
      next(e);
    }
  };

  users = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.users(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Users fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateUserStatus(
          adminId(res),
          req.params.userId as string,
          req.body.isActive
        ),
        "User status updated."
      );
    } catch (e) {
      next(e);
    }
  };

  updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateUserRole(
          adminId(res),
          req.params.userId as string,
          req.body.role
        ),
        "User role updated."
      );
    } catch (e) {
      next(e);
    }
  };

  createAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createAdmin(adminId(res), req.body),
        "Admin created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  admins = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.admins(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Admins fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  updateAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateAdmin(
          adminId(res),
          req.params.adminId as string,
          req.body
        ),
        "Admin updated."
      );
    } catch (e) {
      next(e);
    }
  };

  changeAdminRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.changeAdminRole(
          adminId(res),
          req.params.adminId as string,
          req.body.role
        ),
        "Admin role updated."
      );
    } catch (e) {
      next(e);
    }
  };

  resetAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.resetAdminPassword(
          adminId(res),
          req.params.adminId as string,
          req.body.newPassword
        ),
        "Admin password reset successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  auditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.auditLogs(adminId(res), req.query), "Audit logs fetched.");
    } catch (e) {
      next(e);
    }
  };

  branches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.branches(
          adminId(res),
          Number(req.query.page ?? 1),
          Number(req.query.limit ?? 20)
        ),
        "Branches fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  createBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createBranch(adminId(res), req.body),
        "Branch created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  updateBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.updateBranch(
          adminId(res),
          req.params.branchId as string,
          req.body
        ),
        "Branch updated."
      );
    } catch (e) {
      next(e);
    }
  };

  settings = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.settings(adminId(res)), "System settings fetched.");
    } catch (e) {
      next(e);
    }
  };

  upsertSetting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.upsertSetting(
          adminId(res),
          req.body.key,
          req.body.value,
          req.body.description
        ),
        "System setting updated."
      );
    } catch (e) {
      next(e);
    }
  };

  report = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.report(adminId(res)), "Admin report fetched.");
    } catch (e) {
      next(e);
    }
  };

  notifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const isRead =
        req.query.isRead !== undefined ? req.query.isRead === "true" : undefined;
      const type = req.query.type as string | undefined;

      sendSuccess(
        res,
        await this.service.notifications(adminId(res), {
          page,
          limit,
          isRead,
          type,
        }),
        "Admin notifications fetched successfully."
      );
    } catch (e) {
      next(e);
    }
  };

  markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.markNotificationRead(
          adminId(res),
          req.params.id as string
        ),
        "Notification marked as read."
      );
    } catch (e) {
      next(e);
    }
  };

  markAllNotificationsRead = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.markAllNotificationsRead(adminId(res)),
        "All notifications marked as read."
      );
    } catch (e) {
      next(e);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.deleteNotification(
          adminId(res),
          req.params.id as string
        ),
        "Notification deleted."
      );
    } catch (e) {
      next(e);
    }
  };

  clearReadNotifications = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.clearReadNotifications(adminId(res)),
        "All read notifications cleared."
      );
    } catch (e) {
      next(e);
    }
  };

  broadcastNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.broadcastNotification(adminId(res), req.body),
        "Notification broadcast dispatched successfully."
      );
    } catch (e) {
      next(e);
    }
  };
}
