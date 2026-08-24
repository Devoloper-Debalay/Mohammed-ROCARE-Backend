import { Router } from "express";
import vendorAuthRouter from "../modules/auth/vendor/vendor-auth.router";
import vendorRouter from "../modules/vendor/vendor.router";
import leadReviewRouter from "../modules/vendor/lead-review.public.router";

const mainRouter = Router()

// API Routes
// Vendor module (Phase 1)
mainRouter.use("/vendor/auth", vendorAuthRouter);
mainRouter.use("/vendor", vendorRouter);
// Public — client submits the review with the token from the completion QR, not a vendor token.
mainRouter.use("/leads", leadReviewRouter);

export default mainRouter