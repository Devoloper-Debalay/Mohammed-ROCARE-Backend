import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import createHttpError from "http-errors";
import { AdminService } from "./admin.service";
import { sendSuccess } from "../../shared/response";

function adminId(res: Response): string { const id = res.locals.adminId as string | undefined; if (!id) throw createHttpError(401, "Unauthenticated admin request."); return id; }

@injectable()
export class AdminController {
  constructor(@inject(AdminService) private readonly service: AdminService) {}
  me = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.context(adminId(res)), "Admin context fetched."); } catch (e) { next(e); } };
  pendingStartProofs = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.pendingStartProofs(adminId(res)), "Pending start proofs fetched."); } catch (e) { next(e); } };
  pendingDenialProofs = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.pendingDenialProofs(adminId(res)), "Pending denial proofs fetched."); } catch (e) { next(e); } };
  pendingVendors = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.pendingVendors(adminId(res)), "Pending vendors fetched."); } catch (e) { next(e); } };
  blockedTechnicians = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.blockedTechnicians(adminId(res)), "Blocked technicians fetched."); } catch (e) { next(e); } };
  vendors = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.vendors(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Vendors fetched."); } catch (e) { next(e); } };
  verifyVendor = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.verifyVendor(adminId(res), req.params.vendorId as string, req.body.approved, req.body.reason), "Vendor verification updated."); } catch (e) { next(e); } };
  publishVendor = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.publishVendor(adminId(res), req.params.vendorId as string), "Vendor published."); } catch (e) { next(e); } };
  unblockVendor = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.unblockVendor(adminId(res), req.params.vendorId as string), "Vendor unblocked."); } catch (e) { next(e); } };
  assignVendorBranch = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.assignVendorBranch(adminId(res), req.params.vendorId as string, req.body.branchId), "Vendor branch updated."); } catch (e) { next(e); } };
  leads = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.leads(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20), typeof req.query.branchId === "string" ? req.query.branchId : undefined), "Leads fetched."); } catch (e) { next(e); } };
  reviewStart = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.reviewStartProof(adminId(res), req.params.proofId as string, req.body.approved), "Start proof reviewed."); } catch (e) { next(e); } };
  reviewDenial = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.reviewDenialProof(adminId(res), req.params.proofId as string, req.body.approved), "Denial proof reviewed."); } catch (e) { next(e); } };
  orders = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.orders(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Orders fetched."); } catch (e) { next(e); } };
  updateOrder = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateOrder(adminId(res), req.params.orderId as string, req.body.status), "Order status updated."); } catch (e) { next(e); } };
  walletCredit = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.walletCredit(adminId(res), req.body.vendorId, req.body.amount, req.body.note), "Wallet credited."); } catch (e) { next(e); } };
  walletDebit = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.walletDebit(adminId(res), req.body.vendorId, req.body.amount, req.body.note), "Wallet debited."); } catch (e) { next(e); } };
  walletUpdate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.walletUpdate(adminId(res), req.body.vendorId, req.body.amount, req.body.note), "Wallet updated."); } catch (e) { next(e); } };
  payments = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.payments(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Payments fetched."); } catch (e) { next(e); } };
  confirmPayment = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.confirmPayment(adminId(res), req.params.paymentId as string, req.body.approved, req.body.transactionId), "Payment reviewed."); } catch (e) { next(e); } };
  products = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.products(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Products fetched."); } catch (e) { next(e); } };
  createProduct = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.createProduct(adminId(res), req.body), "Product created.", 201); } catch (e) { next(e); } };
  updateProduct = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateProduct(adminId(res), req.params.productId as string, req.body), "Product updated."); } catch (e) { next(e); } };
  services = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.services(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Services fetched."); } catch (e) { next(e); } };
  createService = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.createService(adminId(res), req.body), "Service created.", 201); } catch (e) { next(e); } };
  updateService = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateService(adminId(res), req.params.serviceId as string, req.body), "Service updated."); } catch (e) { next(e); } };
  complaints = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.adminComplaints(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Complaints fetched."); } catch (e) { next(e); } };
  replyComplaint = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.adminComplaintReply(adminId(res), req.params.complaintId as string, req.body.reply, req.body.status), "Complaint updated."); } catch (e) { next(e); } };
  users = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.users(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Users fetched."); } catch (e) { next(e); } };
  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateUserStatus(adminId(res), req.params.userId as string, req.body.isActive), "User status updated."); } catch (e) { next(e); } };
  updateUserRole = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateUserRole(adminId(res), req.params.userId as string, req.body.role), "User role updated."); } catch (e) { next(e); } };
  createAdmin = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.createAdmin(adminId(res), req.body), "Admin created.", 201); } catch (e) { next(e); } };
  admins = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.admins(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Admins fetched."); } catch (e) { next(e); } };
  updateAdmin = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateAdmin(adminId(res), req.params.adminId as string, req.body), "Admin updated."); } catch (e) { next(e); } };
  changeAdminRole = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.changeAdminRole(adminId(res), req.params.adminId as string, req.body.role), "Admin role updated."); } catch (e) { next(e); } };
  resetAdminPassword = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.resetAdminPassword(adminId(res), req.params.adminId as string, req.body.newPassword), "Admin password reset successfully."); } catch (e) { next(e); } };
  auditLogs = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.auditLogs(adminId(res), req.query), "Audit logs fetched."); } catch (e) { next(e); } };
  branches = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.branches(adminId(res), Number(req.query.page ?? 1), Number(req.query.limit ?? 20)), "Branches fetched."); } catch (e) { next(e); } };
  createBranch = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.createBranch(adminId(res), req.body), "Branch created.", 201); } catch (e) { next(e); } };
  updateBranch = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.updateBranch(adminId(res), req.params.branchId as string, req.body), "Branch updated."); } catch (e) { next(e); } };
  settings = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.settings(adminId(res)), "System settings fetched."); } catch (e) { next(e); } };
  upsertSetting = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.upsertSetting(adminId(res), req.body.key, req.body.value, req.body.description), "System setting updated."); } catch (e) { next(e); } };
  report = async (_req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.service.report(adminId(res)), "Admin report fetched."); } catch (e) { next(e); } };
}
