import { Router } from "express";
import rateLimit from "express-rate-limit";
import "../../../container";
import { container } from "tsyringe";
import { VendorAuthController } from "./vendor-auth.controller";
import { dtoValidation } from "../../../middlewares/dtoValidation";
import { requireVendorAuth } from "./vendor-auth.middleware";
import {
  VendorSignupDto,
  VendorLoginDto,
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  LogoutDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./vendor-auth.dto";

const vendorAuthRouter = Router();
const controller = container.resolve(VendorAuthController);

// Auth routes are a prime brute-force target — tighter limit than the
// global 100/min limiter in app.ts.
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { success: false, message: "Too many requests — please slow down." },
});
vendorAuthRouter.use(authLimiter);

vendorAuthRouter.post("/signup", dtoValidation(VendorSignupDto), controller.signup);
vendorAuthRouter.post("/login", dtoValidation(VendorLoginDto), controller.login);
vendorAuthRouter.post("/send-otp", dtoValidation(SendOtpDto), controller.sendOtp);
vendorAuthRouter.post("/verify-otp", dtoValidation(VerifyOtpDto), controller.verifyOtp);vendorAuthRouter.post("/refresh-token", dtoValidation(RefreshTokenDto), controller.refreshToken);
vendorAuthRouter.post("/logout", requireVendorAuth, dtoValidation(LogoutDto), controller.logout);
vendorAuthRouter.post("/forgot-password", dtoValidation(ForgotPasswordDto), controller.forgotPassword);
vendorAuthRouter.post("/reset-password", dtoValidation(ResetPasswordDto), controller.resetPassword);

export default vendorAuthRouter;
