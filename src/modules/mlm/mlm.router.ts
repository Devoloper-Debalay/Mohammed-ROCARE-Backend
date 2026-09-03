import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { MlmController } from "./mlm.controller";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { requireAdminAuth } from "../../middlewares/admin-auth.middleware";
import { requireVendorAuth } from "../auth/vendor/vendor-auth.middleware";
import { requireCustomerAuth } from "../customer/customer.middleware";
import { CreateWithdrawalRequestDto, ReviewWithdrawalDto } from "./mlm.dto";

const router = Router();
const controller = container.resolve(MlmController);

// Customer MLM Endpoints
router.get("/customer/dashboard", requireCustomerAuth, controller.customerDashboard);
router.get("/customer/network", requireCustomerAuth, controller.genealogyTree);
router.get("/customer/commissions", requireCustomerAuth, controller.customerCommissions);
router.post("/customer/withdraw", requireCustomerAuth, dtoValidation(CreateWithdrawalRequestDto), controller.customerWithdraw);

// Vendor MLM Endpoints
router.get("/vendor/dashboard", requireVendorAuth, controller.vendorDashboard);
router.get("/vendor/commissions", requireVendorAuth, controller.vendorCommissions);
router.post("/vendor/withdraw", requireVendorAuth, dtoValidation(CreateWithdrawalRequestDto), controller.vendorWithdraw);

// Admin Withdrawal Endpoints
router.get("/admin/withdrawals", requireAdminAuth, controller.adminListWithdrawals);
router.patch("/admin/withdrawals/:id/review", requireAdminAuth, dtoValidation(ReviewWithdrawalDto), controller.adminReviewWithdrawal);

export default router;
