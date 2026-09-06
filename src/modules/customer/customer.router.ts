import { Router } from "express";
import rateLimit from "express-rate-limit";
import "../../container";
import { container } from "tsyringe";
import { CustomerController } from "./customer.controller";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { requireCustomerAuth } from "./customer.middleware";
import {
  CustomerSignupDto,
  CustomerLoginDto,
  CustomerResetPasswordDto,
  CustomerAddressDto,
  CustomerCreateLeadDto,
} from "./customer.dto";

const router = Router();
const c = container.resolve(CustomerController);

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { success: false, message: "Too many authentication requests. Please try again later." },
});

router.use("/auth", authLimiter);
router.post("/auth/signup", dtoValidation(CustomerSignupDto), c.signup);
router.post("/auth/login", dtoValidation(CustomerLoginDto), c.login);
router.post("/auth/signin", dtoValidation(CustomerLoginDto), c.login);
router.get("/auth/security-question", c.getSecurityQuestion);
router.post("/auth/reset-password", dtoValidation(CustomerResetPasswordDto), c.resetPassword);

/*
// OTP routes commented out
router.post("/auth/send-otp", dtoValidation(CustomerOtpDto), c.sendOtp);
router.post("/auth/verify-otp", dtoValidation(CustomerVerifyOtpDto), c.verifyOtp);
*/

router.use(requireCustomerAuth);
router.get("/profile", c.profile);
router.get("/addresses", c.addresses);
router.post("/addresses", dtoValidation(CustomerAddressDto), c.addAddress);
router.patch("/addresses/:id", dtoValidation(CustomerAddressDto), c.updateAddress);
router.delete("/addresses/:id", c.deleteAddress);

// Customer Lead Creation
router.post("/leads", dtoValidation(CustomerCreateLeadDto), c.createLead);

export default router;
