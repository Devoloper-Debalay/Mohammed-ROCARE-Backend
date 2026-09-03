/**
 * Router registry for the completed module set.
 * Mount these in your existing base router; keeping mounting explicit avoids
 * changing an application's established API prefix conventions.
 */
export { default as adminAuthRouter } from "./auth/admin/admin-auth.router";
export { default as adminRouter } from "./admin/admin.router";
export { default as adminAnalyticsRouter } from "./admin/analytics/analytics.router";
export { default as customerRouter } from "./customer/customer.router";
export { default as vendorAuthRouter } from "./auth/vendor/vendor-auth.router";
export { default as vendorRouter } from "./vendor/vendor.router";
export { default as cartRouter } from "./cart/cart.router";
export { default as orderRouter } from "./orders/order.router";
export { default as mlmRouter } from "./mlm/mlm.router";
export { default as serviceRequestRouter } from "./service-request/service-request.router";
export { default as paymentRouter } from "./payment/payment.router";
export { default as productsRouter } from "./products/products.router";
export { default as offersRouter } from "./offers/offers.router";
export { default as walletRouter } from "./wallet/wallet.router";
export { default as notificationRouter } from "./notification/notification.router";
export { default as complaintRouter } from "./complaints/complaint.router";
export { default as settingsRouter } from "./settings/settings.router";
export { default as trackingRouter } from "./tracking/tracking.router";
export { default as chatRouter } from "../chat/chat.router";
export { default as chatbotRouter } from "../chatbot/chatbot.router";
export { default as feedbackRouter } from "./feedback/feedback.router";
export { default as leadReviewPublicRouter } from "./vendor/lead-review.public.router";
