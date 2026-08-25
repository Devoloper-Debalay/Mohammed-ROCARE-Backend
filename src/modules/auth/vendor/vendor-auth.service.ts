import { injectable, inject } from "tsyringe";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { VendorRepository } from "../../vendor/vendor.repository";
import { VendorAuthRepository } from "./vendor-auth.repository";
import {
  signVendorAccessToken,
  signVendorRefreshToken,
  verifyVendorRefreshToken,
  getVendorTokenExpiry,
} from "./vendor-token.util";
import { OtpPurpose, VendorProfileStatus, VendorVerificationStatus } from "../../../generated/prisma/enums";
import { sendMail } from "../../../utils/mailer";
import { vendorSmsService } from "./vendor-sms.service";
import { normalizeVendorPhone } from "./vendor-phone.util";
import { registrationReceivedEmail, passwordChangedEmail, otpEmail, loginSuccessEmail } from "../../../utils/vendorMailTemplates";
import { isEmail } from "class-validator";
import { normalizeIdentifier } from "../../../utils/auth.util";

const SALT_ROUNDS = 10;

function generateVendorCode(): string {
  return `VEN-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
}

function generateReferralCode(fullName: string): string {
  const initials = fullName.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "VEN";
  return `${initials}${Math.floor(1000 + Math.random() * 9000)}`;
}

@injectable()
export class VendorAuthService {
  constructor(
    @inject(VendorRepository) private readonly vendorRepo: VendorRepository,
    @inject(VendorAuthRepository) private readonly authRepo: VendorAuthRepository
  ) { }

  async signup(input: {
    role: "AGENT" | "TECHNICIAN";
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    referralCode?: string;
  }) {
    const phone = normalizeVendorPhone(input.phone);
    const existing = await this.vendorRepo.findByPhone(phone);
    if (existing) throw createHttpError(409, "A vendor with this phone number already exists.");

    if (input.email) {
      const existingEmail = await this.vendorRepo.findByEmail(input.email);
      if (existingEmail) throw createHttpError(409, "A vendor with this email already exists.");
    }

    let referredByVendorId: string | undefined;
    if (input.referralCode) {
      // best-effort — an invalid referral code doesn't block signup
      const referrer = await this.vendorRepo.findByReferralCode(input.referralCode).catch(() => null);
      referredByVendorId = referrer?.id;
    }

    const hashed = await bcrypt.hash(input.password, SALT_ROUNDS);

    const vendor = await this.vendorRepo.create({
      vendorCode: generateVendorCode(),
      role: input.role,
      fullName: input.fullName,
      phone,
      email: input.email,
      password: hashed,
      referralCode: generateReferralCode(input.fullName),
      referredByVendorId,
    });

    // Send a phone verification OTP. The OTP itself is stored hashed in the database.
    const code = await this.authRepo.createOtp(vendor.phone, "SIGNUP");
    await vendorSmsService.sendOtp(vendor.phone, code, "SIGNUP");

    // Email is best-effort — a mail provider hiccup should never fail signup.
    if (vendor.email) {
      const { subject: welcomeSubject, html: welcomeHtml } = registrationReceivedEmail(vendor.fullName, vendor.vendorCode);
      await sendMail({ to: vendor.email, subject: welcomeSubject, html: welcomeHtml }).catch(() => undefined);

      const { subject: otpSubject, html: otpHtml } = otpEmail(code, "SIGNUP");
      await sendMail({ to: vendor.email, subject: otpSubject, html: otpHtml }).catch(() => undefined);
    }

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      phone: vendor.phone,
      otpSent: true,
    };
  }

  async sendOtp(
    inputIdentifier: string,
    purpose: OtpPurpose
  ) {
    const identifier = normalizeIdentifier(inputIdentifier);

    const vendor = await this.authRepo.findVendorByIdentifier(identifier);

    if (!vendor) {
      throw createHttpError(404, "Vendor not found.");
    }

    const identifierForOtp = isEmail(identifier)
      ? vendor.email!
      : vendor.phone;

    const code = await this.authRepo.createOtp(
      identifierForOtp,
      purpose
    );

    if (isEmail(identifier)) {
      const { subject, html } = otpEmail(
        code,
        String(purpose)
      );

      const result = await sendMail({
        to: identifier,
        subject,
        html,
      });

      if (!result.success) {
        throw createHttpError(
          500,
          result.error || "Failed to send OTP email."
        );
      }
    } else {
      await vendorSmsService.sendOtp(
        identifier,
        code,
        String(purpose)
      );
    }

    return {
      sent: true,
      channel: isEmail(identifier) ? "EMAIL" : "PHONE",
      expiresIn: 300,
    };
  }

  async verifyOtp(
    inputIdentifier: string,
    code: string,
    purpose: OtpPurpose
  ) {
    const identifier = normalizeIdentifier(inputIdentifier);

    const otp = await this.authRepo.findValidOtp(
      identifier,
      code,
      purpose
    );

    if (!otp) {
      throw createHttpError(
        400,
        "Invalid or expired OTP."
      );
    }

    const vendor =
      await this.authRepo.findVendorByIdentifier(identifier);

    if (!vendor || vendor.deletedAt) {
      throw createHttpError(
        404,
        "Vendor not found."
      );
    }

    await this.authRepo.markOtpUsed(otp.id);

    /*
     * PHONE OTP verification.
     *
     * Your Vendor model does not contain emailVerified,
     * so only update phoneVerified here.
     */
    if (String(purpose) === "SIGNUP") {
      await this.vendorRepo.updateProfile(
        vendor.id,
        {
          phoneVerified: true,
        }
      );

      return {
        verified: true,
        phoneVerified: true,
      };
    }

    /*
     * OTP LOGIN
     */
    if (String(purpose) === "LOGIN") {
      if (
        vendor.verificationStatus !==
        VendorVerificationStatus.VERIFIED ||
        vendor.profileStatus !==
        VendorProfileStatus.PUBLISHED
      ) {
        throw createHttpError(
          403,
          `Account not yet active (verification: ${vendor.verificationStatus}, profile: ${vendor.profileStatus}).`
        );
      }

      const accessToken = signVendorAccessToken(
        vendor.id,
        vendor.role
      );

      const refreshToken = signVendorRefreshToken(
        vendor.id,
        vendor.role
      );

      /*
       * Email is only a login notification.
       * OTP authentication itself was done through phone.
       */
      if (vendor.email) {
        const { subject, html } = loginSuccessEmail(
          vendor.fullName,
          "PHONE_OTP"
        );

        await sendMail({
          to: vendor.email,
          subject,
          html,
        }).catch((error) => {
          console.error(
            "[vendor-auth] Login notification email failed:",
            error
          );
        });
      }

      return {
        verified: true,
        accessToken,
        refreshToken,

        accessTokenExpiresAt:
          getVendorTokenExpiry(
            accessToken,
            "access"
          ).toISOString(),

        refreshTokenExpiresAt:
          getVendorTokenExpiry(
            refreshToken,
            "refresh"
          ).toISOString(),

        vendorCode: vendor.vendorCode,
        role: vendor.role,
      };
    }

    /*
     * RESET PASSWORD
     *
     * OTP has already been validated and marked used.
     * The password-reset flow can continue from here.
     */
    return {
      verified: true,
    };
  }

  async login(inputPhone: string, password: string) {
    const phone = normalizeVendorPhone(inputPhone);
    const vendor = await this.vendorRepo.findByPhone(phone);
    if (!vendor || vendor.deletedAt) throw createHttpError(401, "Invalid phone or password.");
    if (!vendor.phoneVerified) throw createHttpError(403, "Phone number is not verified. Please verify your phone first.");

    const matches = await bcrypt.compare(password, vendor.password);
    if (!matches) throw createHttpError(401, "Invalid phone or password.");

    // Core rule from the signup flow: can't log in until verified + published.
    if (
      vendor.verificationStatus !== VendorVerificationStatus.VERIFIED ||
      vendor.profileStatus !== VendorProfileStatus.PUBLISHED
    ) {
      throw createHttpError(
        403,
        `Account not yet active (verification: ${vendor.verificationStatus}, profile: ${vendor.profileStatus}). Please wait for admin approval.`
      );
    }

    const accessToken = signVendorAccessToken(vendor.id, vendor.role);
    const refreshToken = signVendorRefreshToken(vendor.id, vendor.role);

    if (vendor.email) {
      const { subject, html } = loginSuccessEmail(vendor.fullName, "PASSWORD");
      await sendMail({ to: vendor.email, subject, html }).catch(() => undefined);
    }

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: getVendorTokenExpiry(accessToken, "access").toISOString(),
      refreshTokenExpiresAt: getVendorTokenExpiry(refreshToken, "refresh").toISOString(),
      vendorId: vendor.id,
      role: vendor.role,
    };
  }

  async refreshToken(refreshToken: string) {
    if (await this.authRepo.isTokenBlacklisted(refreshToken)) {
      throw createHttpError(401, "Refresh token has been invalidated. Please log in again.");
    }

    const decoded = verifyVendorRefreshToken(refreshToken);
    const vendor = await this.vendorRepo.findById(decoded.vendorId);
    if (!vendor || vendor.deletedAt) throw createHttpError(401, "Invalid refresh token.");

    // Rotate refresh tokens: once used, the old refresh token cannot be replayed.
    const accessToken = signVendorAccessToken(vendor.id, vendor.role);
    const nextRefreshToken = signVendorRefreshToken(vendor.id, vendor.role);
    await this.authRepo.blacklistToken(refreshToken, getVendorTokenExpiry(refreshToken, "refresh"));

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresAt: getVendorTokenExpiry(accessToken, "access").toISOString(),
      refreshTokenExpiresAt: getVendorTokenExpiry(nextRefreshToken, "refresh").toISOString(),
      vendorId: vendor.id,
      role: vendor.role,
    };
  }

  async logout(accessToken: string, refreshToken?: string) {
    // Access token is already authenticated by the controller/middleware path;
    // verify it here too so its actual expiry is used for the blacklist record.
    const accessExpiresAt = getVendorTokenExpiry(accessToken, "access");
    await this.authRepo.blacklistToken(accessToken, accessExpiresAt);

    if (refreshToken) {
      try {
        const refreshExpiresAt = getVendorTokenExpiry(refreshToken, "refresh");
        await this.authRepo.blacklistToken(refreshToken, refreshExpiresAt);
      } catch {
        // Logout remains successful if the refresh token is already expired/invalid.
      }
    }
  }

  async forgotPassword(identifier: string) {
    return this.sendOtp(identifier, "RESET_PASSWORD");
  }

  async resetPassword(
    inputIdentifier: string,
    code: string,
    newPassword: string
  ) {
    const identifier = normalizeIdentifier(inputIdentifier);

    const otp = await this.authRepo.findValidOtp(
      identifier,
      code,
      "RESET_PASSWORD"
    );

    if (!otp) {
      throw createHttpError(400, "Invalid or expired OTP.");
    }

    const vendor = await this.authRepo.findVendorByIdentifier(identifier);

    if (!vendor) {
      throw createHttpError(404, "Vendor not found.");
    }

    await this.authRepo.markOtpUsed(otp.id);

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.vendorRepo.updatePassword(vendor.id, hashedPassword);

    if (vendor.email) {
      const { subject, html } = passwordChangedEmail(vendor.fullName);

      await sendMail({
        to: vendor.email,
        subject,
        html,
      }).catch(() => undefined);
    }

    return {
      success: true,
      message: "Password updated successfully.",
    };
  }
}

