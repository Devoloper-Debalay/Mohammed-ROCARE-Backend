import { Router } from "express";

// Vendor
import vendorAuthRouter from "../modules/auth/vendor/vendor-auth.router";
import vendorRouter from "../modules/vendor/vendor.router";
import leadReviewRouter from "../modules/vendor/lead-review.public.router";

// Customer
import customerRouter from "../modules/customer/customer.router";

// Admin
import adminRouter from "../modules/admin/admin.router";
import adminAuthRouter from "../modules/auth/admin/admin-auth.router";
import analyticsRouter from "../modules/admin/analytics/analytics.router";

// Catalog / Commerce
import productsRouter from "../modules/products/products.router";
import cartRouter from "../modules/cart/cart.router";
import orderRouter from "../modules/orders/order.router";
import offersRouter from "../modules/offers/offers.router";

// Service Requests
import serviceRequestRouter from "../modules/service-request/service-request.router";
import customerServiceRequestRouter from "../modules/service-request/customer-service-request.router";
import vendorLeadsRouter from "../modules/service-request/vendor-leads.router";

// Wallet / Payments
import paymentRouter from "../modules/payment/payment.router";
import walletRouter from "../modules/wallet/wallet.router";

// Notification / Feedback / Complaint / Tracking
import notificationRouter from "../modules/notification/notification.router";
import feedbackRouter from "../modules/feedback/feedback.router";
import complaintsRouter from "../modules/complaints/complaint.router";
import trackingRouter from "../modules/tracking/tracking.router";

// Settings
import settingsRouter from "../modules/settings/settings.router";

// Chat
import chatRouter from "../chat/chat.router";
import chatbotRouter from "../chatbot/chatbot.router";

const mainRouter = Router();

/* ---------------- Vendor ---------------- */
mainRouter.use("/vendor/auth", vendorAuthRouter);
mainRouter.use("/vendor", vendorRouter);
mainRouter.use("/vendor/leads", vendorLeadsRouter);

/* Public Lead Review */
mainRouter.use("/leads", leadReviewRouter);

/* ---------------- Customer ---------------- */
mainRouter.use("/customer", customerRouter);

/* ---------------- Service Requests ---------------- */
mainRouter.use("/customer/service-request", customerServiceRequestRouter);
mainRouter.use("/service-request", serviceRequestRouter);

/* ---------------- Catalog ---------------- */
mainRouter.use("/catalog", productsRouter);

/* ---------------- Cart & Orders ---------------- */
mainRouter.use("/cart", cartRouter);
mainRouter.use("/orders", orderRouter);

/* ---------------- Offers ---------------- */
mainRouter.use("/offers", offersRouter);

/* ---------------- Payments & Wallet ---------------- */
mainRouter.use("/payments", paymentRouter);
mainRouter.use("/wallet", walletRouter);

/* ---------------- Notifications ---------------- */
mainRouter.use("/notifications", notificationRouter);

/* ---------------- Feedback ---------------- */
mainRouter.use("/feedback", feedbackRouter);

/* ---------------- Complaints ---------------- */
mainRouter.use("/complaints", complaintsRouter);

/* ---------------- Tracking ---------------- */
mainRouter.use("/tracking", trackingRouter);

/* ---------------- Chat ---------------- */
mainRouter.use("/chat", chatRouter);
mainRouter.use("/chatbot", chatbotRouter);

/* ---------------- Super Admin ---------------- */
mainRouter.use("/super-admin/settings", settingsRouter);
mainRouter.use("/super-admin", analyticsRouter);

/* ---------------- Admin ---------------- */
mainRouter.use("/admin/auth", adminAuthRouter);
mainRouter.use("/admin", adminRouter);

export default mainRouter;