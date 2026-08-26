import { Router } from "express";
import vendorAuthRouter from "../modules/auth/vendor/vendor-auth.router";
import vendorRouter from "../modules/vendor/vendor.router";
import leadReviewRouter from "../modules/vendor/lead-review.public.router";
import adminRouter from "../modules/admin/admin.router";
import adminAuthRouter from "../modules/auth/admin/admin-auth.router";
import analyticsRouter from "../modules/admin/analytics/analytics.router";
import customerRouter from "../modules/customer/customer.router";
import notificationRouter from "../modules/notification/notification.router";
import offersRouter from "../modules/offers/offers.router";
import paymentRouter from "../modules/payment/payment.router";
import productsRouter from "../modules/products/products.router";
import customerServiceRequestRouter from "../modules/service-request/customer-service-request.router";
import vendorLeadsRouter from "../modules/service-request/vendor-leads.router";
import settingsRouter from "../modules/settings/settings.router";
import walletRouter from "../modules/wallet/wallet.router";
import complaintsRouter from "../modules/complaints/complaint.router";

const mainRouter = Router()

// API Routes
// Vendor module (Phase 1)
mainRouter.use("/vendor/auth", vendorAuthRouter);
mainRouter.use("/vendor", vendorRouter);

// Public — client submits the review with the token from the completion QR, not a vendor token.
mainRouter.use("/leads", leadReviewRouter);
mainRouter.use("/vendor/leads", vendorLeadsRouter);

// Customer module
mainRouter.use("/customer", customerRouter);
mainRouter.use("/customer/service-request", customerServiceRequestRouter);

//Payment and Wallet module
mainRouter.use("/payments", paymentRouter);
mainRouter.use("/wallet", walletRouter);

//Nitification Route
mainRouter.use("/notifications", notificationRouter);

//Catalog module
mainRouter.use("/catalog", productsRouter);

//Offers module
mainRouter.use("/offers", offersRouter);

//Complaints module
mainRouter.use("/complaints", complaintsRouter);

//Super Admin module
mainRouter.use("/super-admin/settings", settingsRouter);
mainRouter.use("/super-admin", analyticsRouter);

//Admin module
mainRouter.use("/admin/auth", adminAuthRouter);
mainRouter.use("/admin", adminRouter);

export default mainRouter