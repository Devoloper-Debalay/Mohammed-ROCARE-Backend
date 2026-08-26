import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { AdminController } from "./admin.controller";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { requireAdminAuth, requireAdminRole } from "../../middlewares/admin-auth.middleware";
import { Role } from "../../generated/prisma/enums";
import { AssignBranchDto, BranchDto, CreateAdminDto, OrderStatusDto, PaymentDecisionDto, ProductDto, ServiceDto, SettingDto, UserRoleDto, UserStatusDto, VendorDecisionDto, WalletAdjustmentDto, ComplaintReplyDto, UpdateAdminDto, ResetAdminPasswordDto, AdminRoleDto, AuditLogQueryDto } from "./admin.dto";

const router = Router();
const controller = container.resolve(AdminController);

// Login lives at /admin/auth/login via admin-auth.router.ts (mounted
// separately in base.router.ts, ahead of this router) — this router only
// handles authenticated admin business endpoints.
router.use(requireAdminAuth);

router.get("/me", controller.me);
router.get("/dashboard", controller.report);
router.get("/vendors/pending", controller.pendingVendors);
router.get("/vendors/blocked", controller.blockedTechnicians);
router.get("/vendors", controller.vendors);
router.patch("/vendors/:vendorId/verify", dtoValidation(VendorDecisionDto), controller.verifyVendor);
router.patch("/vendors/:vendorId/publish", controller.publishVendor);
router.patch("/vendors/:vendorId/unblock", controller.unblockVendor);
router.patch("/vendors/:vendorId/branch", dtoValidation(AssignBranchDto), requireAdminRole(Role.SADMIN), controller.assignVendorBranch);

router.get("/leads", controller.leads);
router.get("/leads/start-proofs/pending", controller.pendingStartProofs);
router.get("/leads/denial-proofs/pending", controller.pendingDenialProofs);
router.post("/leads/start-proofs/:proofId/review", dtoValidation(VendorDecisionDto), controller.reviewStart);
router.post("/leads/denial-proofs/:proofId/review", dtoValidation(VendorDecisionDto), controller.reviewDenial);

router.post("/wallet/credit", dtoValidation(WalletAdjustmentDto), controller.walletCredit);
router.post("/wallet/debit", dtoValidation(WalletAdjustmentDto), controller.walletDebit);
router.post("/wallet/update", dtoValidation(WalletAdjustmentDto), controller.walletUpdate);

router.get("/orders", controller.orders);
router.patch("/orders/:orderId/status", dtoValidation(OrderStatusDto), controller.updateOrder);
router.get("/payments", controller.payments);
router.post("/payments/:paymentId/review", dtoValidation(PaymentDecisionDto), controller.confirmPayment);

router.get("/products", controller.products);
router.post("/products", dtoValidation(ProductDto), controller.createProduct);
router.patch("/products/:productId", dtoValidation(ProductDto), controller.updateProduct);
router.get("/services", controller.services);
router.post("/services", dtoValidation(ServiceDto), controller.createService);
router.patch("/services/:serviceId", dtoValidation(ServiceDto), controller.updateService);

router.get("/complaints", controller.complaints);
router.patch("/complaints/:complaintId", dtoValidation(ComplaintReplyDto), controller.replyComplaint);

router.use("/super", requireAdminRole(Role.SADMIN));
router.get("/super/users", controller.users);
router.get("/super/admins", controller.admins);
router.get("/super/audit-logs", dtoValidation(AuditLogQueryDto), controller.auditLogs);
router.patch("/super/users/:userId/status", dtoValidation(UserStatusDto), controller.updateUserStatus);
router.patch("/super/users/:userId/role", dtoValidation(UserRoleDto), controller.updateUserRole);
router.post("/super/admins", dtoValidation(CreateAdminDto), controller.createAdmin);
router.patch("/super/admins/:adminId", dtoValidation(UpdateAdminDto), controller.updateAdmin);
router.patch("/super/admins/:adminId/role", dtoValidation(AdminRoleDto), controller.changeAdminRole);
router.post("/super/admins/:adminId/reset-password", dtoValidation(ResetAdminPasswordDto), controller.resetAdminPassword);
router.get("/super/branches", controller.branches);
router.post("/super/branches", dtoValidation(BranchDto), controller.createBranch);
router.patch("/super/branches/:branchId", dtoValidation(BranchDto), controller.updateBranch);
router.get("/super/settings", controller.settings);
router.put("/super/settings", dtoValidation(SettingDto), controller.upsertSetting);
router.get("/super/reports", controller.report);

export default router;
