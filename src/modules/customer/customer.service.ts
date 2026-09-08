import { injectable, inject } from "tsyringe";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { CustomerRepository } from "./customer.repository";
import { normalizeIdentifier } from "../../utils/auth.util";
import { normalizeVendorPhone } from "../auth/vendor/vendor-phone.util";
import { isEmail } from "class-validator";
import { signCustomerAccessToken } from "./customer-token.util";
import { sendMail } from "../../utils/mailer";
import { otpEmail } from "../../utils/vendorMailTemplates";
import { vendorSmsService } from "../auth/vendor/vendor-sms.service";
import { createHash, randomInt, randomBytes } from "crypto";
import prisma from "../../config/database";
import { logActivity, sendMailSafe, simpleEmail } from "../../utils/serviceEvents";
import { LeadStatus } from "../../generated/prisma/enums";

import { MlmService } from "../mlm/mlm.service";

const hash = (v: string) => createHash("sha256").update(v).digest("hex");

@injectable()
export class CustomerService {
  constructor(
    @inject(CustomerRepository) private readonly repo: CustomerRepository,
    @inject(MlmService) private readonly mlmService: MlmService
  ) {}

  /*
  // OTP service commented out
  private async issueOtp(identifier: string, purpose: "SIGNUP" | "LOGIN") {
    const code = String(randomInt(100000, 1000000));
    await prisma.otpCode.create({
      data: {
        identifier,
        purpose,
        code: hash(code),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    if (isEmail(identifier)) {
      const { subject, html } = otpEmail(code, purpose);
      const result = await sendMail({ to: identifier, subject, html });
      if (!result.success) throw createHttpError(500, result.error || "Failed to send OTP email.");
    } else {
      await vendorSmsService.sendOtp(identifier, code, purpose);
    }
    return code;
  }
  */

  async signup(input: any) {
    let phone: string | undefined;
    let email: string | undefined;

    if (input.phone) {
      phone = normalizeVendorPhone(input.phone);
    }
    if (input.email) {
      email = input.email.trim().toLowerCase();
    }
    if (input.identifier) {
      if (isEmail(input.identifier)) {
        email = email || input.identifier.trim().toLowerCase();
      } else {
        phone = phone || normalizeVendorPhone(input.identifier);
      }
    }

    if (!phone && !email) {
      throw createHttpError(400, "Phone number or email identifier is required.");
    }

    if (!input.password || typeof input.password !== "string" || input.password.length < 6) {
      throw createHttpError(400, "Password is required and must be at least 6 characters.");
    }

    const existing =
      (phone ? await this.repo.findUser(phone) : null) ||
      (email ? await this.repo.findUser(email) : null);

    if (existing) {
      throw createHttpError(
        409,
        "A customer with this phone or email already exists."
      );
    }

    const password = await bcrypt.hash(input.password, 10);

    let sponsorId: string | undefined = undefined;
    if (input.referralCode) {
      const trimmedCode = input.referralCode.trim();
      const sponsorUser = await prisma.user.findFirst({
        where: { referralCode: trimmedCode },
      });
      if (sponsorUser) {
        sponsorId = sponsorUser.id;
      } else {
        const sponsorVendor = await prisma.vendor.findFirst({
          where: { referralCode: trimmedCode },
        });
        if (sponsorVendor) {
          let linkedUser = await prisma.user.findFirst({
            where: {
              OR: [
                ...(sponsorVendor.email ? [{ email: sponsorVendor.email }] : []),
                { phone: sponsorVendor.phone },
              ],
            },
          });
          if (!linkedUser) {
            linkedUser = await prisma.user.create({
              data: {
                firstName: sponsorVendor.fullName.split(" ")[0] || "Vendor",
                lastName: sponsorVendor.fullName.split(" ").slice(1).join(" ") || "",
                email:
                  sponsorVendor.email ||
                  `${sponsorVendor.phone.replace(/\D/g, "")}@vendor.just24you.local`,
                phone: sponsorVendor.phone,
                password: sponsorVendor.password,
                role: "VENDOR" as any,
                referralCode: sponsorVendor.referralCode,
              },
            });
          }
          sponsorId = linkedUser.id;
        }
      }
    }

    // Generate user referral code
    const referralCode = `ROC-${randomInt(100000, 999999)}`;
    const homeTown = input.securityAnswer || input.homeTown || "Not mentioned yet.";

    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        middleName: input.middleName || "",
        lastName: input.lastName,
        email: email || `${phone!.replace(/\D/g, "")}@customer.just24you.local`,
        phone,
        password,
        homeTown,
        sponsorId,
        referralCode,
        customerProfile: { create: { phoneVerified: true } },
      },
      include: {
        customerProfile: true,
      },
    });

    // OTP dispatch commented out
    // await this.issueOtp(phone, "SIGNUP");

    await logActivity(user.id, "CUSTOMER_SIGNUP", { phone: user.phone, email: user.email });
    if (email && !email.endsWith("@customer.just24you.local")) {
      await sendMailSafe({
        to: email,
        subject: "Welcome to Just24You",
        html: simpleEmail("Welcome to Just24You", "Your customer account has been created successfully."),
      });
    }

    const accessToken = signCustomerAccessToken(user.id);

    return {
      accessToken,
      customerId: user.id,
      customer: {
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        customerProfile: user.customerProfile,
      },
    };
  }

  async login(identifierInput: string, passwordInput: string) {
    if (!identifierInput || !passwordInput) {
      throw createHttpError(400, "Identifier and password are required.");
    }

    const identifier = isEmail(identifierInput)
      ? normalizeIdentifier(identifierInput)
      : normalizeVendorPhone(identifierInput);

    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(401, "Invalid email/phone or password.");
    }

    if (!user.isActive) {
      throw createHttpError(403, "Customer account is inactive. Please contact support.");
    }

    const matches = await bcrypt.compare(passwordInput, user.password);
    if (!matches) {
      throw createHttpError(401, "Invalid email/phone or password.");
    }

    const accessToken = signCustomerAccessToken(user.id);
    await logActivity(user.id, "CUSTOMER_LOGIN", {
      channel: isEmail(identifier) ? "EMAIL" : "PHONE",
    });

    return {
      accessToken,
      customerId: user.id,
      customer: {
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        customerProfile: user.customerProfile,
      },
    };
  }

  async getSecurityQuestion(identifierInput: string) {
    if (!identifierInput) throw createHttpError(400, "Identifier is required.");
    const identifier = isEmail(identifierInput)
      ? normalizeIdentifier(identifierInput)
      : normalizeVendorPhone(identifierInput);

    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(404, "Customer not found.");
    }

    return {
      identifier,
      securityQuestion: "What is your registered primary hometown / security answer?",
    };
  }

  async resetPassword(identifierInput: string, securityAnswerInput: string, newPassword: string) {
    if (!identifierInput || !securityAnswerInput || !newPassword) {
      throw createHttpError(400, "Identifier, security answer, and new password are required.");
    }
    if (newPassword.length < 6) {
      throw createHttpError(400, "Password must be at least 6 characters long.");
    }

    const identifier = isEmail(identifierInput)
      ? normalizeIdentifier(identifierInput)
      : normalizeVendorPhone(identifierInput);

    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(404, "Customer not found.");
    }

    const savedAnswer = (user.homeTown || "").trim().toLowerCase();
    const providedAnswer = securityAnswerInput.trim().toLowerCase();

    if (savedAnswer && savedAnswer !== "not mentioned yet.") {
      if (savedAnswer !== providedAnswer) {
        throw createHttpError(400, "Incorrect security answer.");
      }
    } else {
      // If user had no security answer previously set, set it on reset
      await this.repo.updateUser(user.id, { homeTown: securityAnswerInput.trim() });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.repo.updatePassword(user.id, hashedPassword);

    await logActivity(user.id, "CUSTOMER_PASSWORD_RESET", {
      channel: isEmail(identifier) ? "EMAIL" : "PHONE",
    });

    if (user.email && !user.email.endsWith("@customer.just24you.local")) {
      await sendMailSafe({
        to: user.email,
        subject: "Just24You password updated",
        html: simpleEmail("Password Updated", "Your Just24You customer account password has been reset successfully."),
      });
    }

    return {
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    };
  }

  /*
  // OTP methods commented out
  async sendOtp(identifierInput: string, purpose: "SIGNUP" | "LOGIN") {
    const identifier = isEmail(identifierInput)
      ? normalizeIdentifier(identifierInput)
      : normalizeVendorPhone(identifierInput);
    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(404, "Customer not found.");
    }
    await this.issueOtp(identifier, purpose);
    return { sent: true, channel: isEmail(identifier) ? "EMAIL" : "PHONE", expiresIn: 300 };
  }

  async verifyOtp(identifierInput: string, code: string, purpose: "SIGNUP" | "LOGIN") {
    const identifier = isEmail(identifierInput)
      ? normalizeIdentifier(identifierInput)
      : normalizeVendorPhone(identifierInput);
    const otp = await prisma.otpCode.findFirst({
      where: { identifier, purpose, code: hash(code), used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) throw createHttpError(400, "Invalid or expired OTP.");
    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(404, "Customer not found.");
    }
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    if (purpose === "SIGNUP" && user.phone === identifier) {
      await prisma.customer.update({ where: { userId: user.id }, data: { phoneVerified: true } });
    }
    await logActivity(user.id, purpose === "LOGIN" ? "CUSTOMER_LOGIN_OTP" : "CUSTOMER_PHONE_VERIFIED", {
      channel: isEmail(identifier) ? "EMAIL" : "PHONE",
    });
    if (purpose === "LOGIN") {
      await sendMailSafe({
        to: user.email,
        subject: "Just24You login successful",
        html: simpleEmail("Login successful", "Your Just24You customer account was accessed successfully."),
      });
    }
    return { verified: true, accessToken: signCustomerAccessToken(user.id), customerId: user.id };
  }
  */

  async profile(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user || user.role !== "CLIENT" || user.deletedAt) {
      throw createHttpError(404, "Customer not found.");
    }
    const rankProgress = this.mlmService.getRankProgress(user.bv.toNumber());
    return {
      ...user,
      rankProgress,
    };
  }

  async addresses(userId: string) {
    const profile = await prisma.customer.findUnique({ where: { userId } });
    if (!profile) throw createHttpError(404, "Customer profile not found.");
    return this.repo.addresses(profile.id);
  }

  async addAddress(userId: string, data: any) {
    const profile = await prisma.customer.findUnique({ where: { userId } });
    if (!profile) throw createHttpError(404, "Customer profile not found.");
    return this.repo.createAddress(profile.id, { ...data, customerId: profile.id });
  }

  async updateAddress(userId: string, id: string, data: any) {
    const profile = await prisma.customer.findUnique({ where: { userId } });
    if (!profile) throw createHttpError(404, "Customer profile not found.");
    const result = await this.repo.updateAddress(profile.id, id, data);
    if (!result.count) throw createHttpError(404, "Address not found.");
    return this.repo.addresses(profile.id);
  }

  async deleteAddress(userId: string, id: string) {
    const profile = await prisma.customer.findUnique({ where: { userId } });
    if (!profile) throw createHttpError(404, "Customer profile not found.");
    const result = await this.repo.deleteAddress(profile.id, id);
    if (!result.count) throw createHttpError(404, "Address not found.");
  }

  /**
   * Customer creates a service lead
   */
  async createLead(userId: string, data: any) {
    const user = await this.profile(userId);

    const lead = await prisma.lead.create({
      data: {
        customerName: data.customerName || `${user.firstName} ${user.lastName}`,
        phone: data.phone || user.phone || "",
        email: data.email || user.email,
        address: data.address,
        district: data.district,
        pincode: data.pincode,
        specialization: data.specialization,
        serviceType: data.serviceType,
        issue: data.issue,
        serviceId: data.serviceId,
        productId: data.productId,
        estimatedAmount: data.estimatedAmount,
        isReleased: false,
        leadCreatedByType: "CUSTOMER",
        createdById: userId,
        status: LeadStatus.NEW,
        source: "ALL",
      },
    });

    await logActivity(userId, "LEAD_CREATED", { leadId: lead.id });
    return lead;
  }
}
