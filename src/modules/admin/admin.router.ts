import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { AdminController } from "./admin.controller";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { upload } from "../../middlewares/upload";
import { requireAdminAuth, requireAdminRole } from "../../middlewares/admin-auth.middleware";
import { Role } from "../../generated/prisma/enums";
import {
  AssignBranchDto,
  BranchDto,
  CreateAdminDto,
  CreateVendorDto,
  AdminCreateLeadDto,
  AdminUpdateLeadDto,
  PriceAndReleaseLeadDto,
  DenialProofReviewDto,
  LeadRefundDto,
  OrderStatusDto,
  PaymentDecisionDto,
  ProductDto,
  PartDto,
  ServiceDto,
  SettingDto,
  UserRoleDto,
  UserStatusDto,
  VendorDecisionDto,
  WalletAdjustmentDto,
  ComplaintReplyDto,
  UpdateAdminDto,
  ResetAdminPasswordDto,
  AdminRoleDto,
  AdminBroadcastNotificationDto,
  AdminCategoryDto,
} from "./admin.dto";

const router = Router();
const controller = container.resolve(AdminController);

router.use(requireAdminAuth);

router.get("/me", controller.me);
router.get("/dashboard", controller.report);

// Notifications
router.get("/notifications", controller.notifications);
router.patch("/notifications/read-all", controller.markAllNotificationsRead);
router.delete("/notifications/clear-all", controller.clearReadNotifications);
router.patch("/notifications/:id/read", controller.markNotificationRead);
router.delete("/notifications/:id", controller.deleteNotification);
router.post("/notifications/broadcast", dtoValidation(AdminBroadcastNotificationDto), controller.broadcastNotification);

// Vendors
router.get("/vendors/pending", controller.pendingVendors);
router.get("/vendors/blocked", controller.blockedTechnicians);
router.get("/vendors", controller.vendors);
router.post("/vendors", dtoValidation(CreateVendorDto), controller.createVendor);
router.patch("/vendors/:vendorId/verify", dtoValidation(VendorDecisionDto), controller.verifyVendor);
router.patch("/vendors/:vendorId/publish", controller.publishVendor);
router.patch("/vendors/:vendorId/unblock", controller.unblockVendor);
router.patch("/vendors/:vendorId/branch", dtoValidation(AssignBranchDto), requireAdminRole(Role.SADMIN), controller.assignVendorBranch);

// Leads
router.get("/leads", controller.leads);
router.post("/leads", dtoValidation(AdminCreateLeadDto), controller.createLead);
router.get("/leads/start-proofs/pending", controller.pendingStartProofs);
router.get("/leads/denial-proofs/pending", controller.pendingDenialProofs);
router.post("/leads/start-proofs/:proofId/review", dtoValidation(VendorDecisionDto), controller.reviewStart);
router.post("/leads/denial-proofs/:proofId/review", dtoValidation(DenialProofReviewDto), controller.reviewDenial);
router.get("/leads/:leadId", controller.lead);
router.patch("/leads/:leadId", dtoValidation(AdminUpdateLeadDto), controller.updateLead);
router.post("/leads/:leadId/refund", dtoValidation(LeadRefundDto), controller.refundLead);
router.patch("/leads/:leadId/price-and-release", dtoValidation(PriceAndReleaseLeadDto), controller.priceAndReleaseLead);

// Wallet
router.get("/wallet/transactions", controller.walletTransactions);
router.post("/wallet/credit", dtoValidation(WalletAdjustmentDto), controller.walletCredit);
router.post("/wallet/debit", dtoValidation(WalletAdjustmentDto), controller.walletDebit);
router.post("/wallet/update", dtoValidation(WalletAdjustmentDto), controller.walletUpdate);

// Orders & Payments
router.get("/orders", controller.orders);
router.patch("/orders/:orderId/status", dtoValidation(OrderStatusDto), controller.updateOrder);
router.get("/payments", controller.payments);
router.post("/payments/:paymentId/review", dtoValidation(PaymentDecisionDto), controller.confirmPayment);

// Categories (Dynamic Products & Services)
router.get("/categories", controller.categories);
router.post("/categories", dtoValidation(AdminCategoryDto), controller.createCategory);
router.get("/categories/:categoryId", controller.category);
router.patch("/categories/:categoryId", dtoValidation(AdminCategoryDto), controller.updateCategory);
router.delete("/categories/:categoryId", controller.deleteCategory);

// Products
router.get("/products", controller.products);
router.post(
  "/products",
  upload.fields([{ name: "images" }, { name: "image" }, { name: "files" }, { name: "file" }]),
  dtoValidation(ProductDto),
  controller.createProduct
);
router.get("/products/:productId", controller.product);
router.patch(
  "/products/:productId",
  upload.fields([{ name: "images" }, { name: "image" }, { name: "files" }, { name: "file" }]),
  dtoValidation(ProductDto),
  controller.updateProduct
);
router.delete("/products/:productId", controller.deleteProduct);
router.post(
  "/products/upload-image",
  upload.single("image"),
  controller.uploadProductImage
);

// Spare Parts
router.get("/parts", controller.parts);
router.post(
  "/parts",
  upload.fields([{ name: "images" }, { name: "image" }, { name: "files" }, { name: "file" }]),
  dtoValidation(PartDto),
  controller.createPart
);
router.get("/parts/:partId", controller.part);
router.patch(
  "/parts/:partId",
  upload.fields([{ name: "images" }, { name: "image" }, { name: "files" }, { name: "file" }]),
  dtoValidation(PartDto),
  controller.updatePart
);
router.delete("/parts/:partId", controller.deletePart);
router.post(
  "/parts/upload-image",
  upload.single("image"),
  controller.uploadPartImage
);

// Services
router.get("/services", controller.services);
router.post("/services", dtoValidation(ServiceDto), controller.createService);
router.patch("/services/:serviceId", dtoValidation(ServiceDto), controller.updateService);

// Complaints
router.get("/complaints", controller.complaints);
router.patch("/complaints/:complaintId", dtoValidation(ComplaintReplyDto), controller.replyComplaint);

// Super Admin Only
router.use("/super", requireAdminRole(Role.SADMIN));
router.get("/super/users", controller.users);
router.get("/super/admins", controller.admins);
router.get("/super/audit-logs", controller.auditLogs);
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
