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

const hash = (v: string) => createHash("sha256").update(v).digest("hex");

@injectable()
export class CustomerService {
  constructor(@inject(CustomerRepository) private readonly repo: CustomerRepository) {}

  private async issueOtp(identifier: string, purpose: "SIGNUP" | "LOGIN") {
    const code = String(randomInt(100000, 1000000));
    await prisma.otpCode.create({ data: { identifier, purpose, code: hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    if (isEmail(identifier)) {
      const { subject, html } = otpEmail(code, purpose);
      const result = await sendMail({ to: identifier, subject, html });
      if (!result.success) throw createHttpError(500, result.error || "Failed to send OTP email.");
    } else {
      await vendorSmsService.sendOtp(identifier, code, purpose);
    }
    return code;
  }

  async signup(input: any) {
    const phone = normalizeVendorPhone(input.phone);
    const email = input.email?.trim().toLowerCase();
    const existing = await this.repo.findUser(phone) || (email ? await this.repo.findUser(email) : null);
    if (existing) throw createHttpError(409, "A customer with this phone or email already exists.");
    const password = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
    const user = await this.repo.createCustomer({ firstName: input.firstName, middleName: input.middleName || "", lastName: input.lastName, email: email || `${phone.replace(/\D/g,"")}@customer.rocare.local`, phone, password });
    await prisma.customer.create({ data: { userId: user.id } });
    await this.issueOtp(phone, "SIGNUP");
    return { customerId: user.id, phone: user.phone, email: input.email, otpSent: true };
  }

  async sendOtp(identifierInput: string, purpose: "SIGNUP" | "LOGIN") {
    const identifier = isEmail(identifierInput) ? normalizeIdentifier(identifierInput) : normalizeVendorPhone(identifierInput);
    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) throw createHttpError(404, "Customer not found.");
    await this.issueOtp(identifier, purpose);
    return { sent: true, channel: isEmail(identifier) ? "EMAIL" : "PHONE", expiresIn: 300 };
  }

  async verifyOtp(identifierInput: string, code: string, purpose: "SIGNUP" | "LOGIN") {
    const identifier = isEmail(identifierInput) ? normalizeIdentifier(identifierInput) : normalizeVendorPhone(identifierInput);
    const otp = await prisma.otpCode.findFirst({ where: { identifier, purpose, code: hash(code), used: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!otp) throw createHttpError(400, "Invalid or expired OTP.");
    const user = await this.repo.findUser(identifier);
    if (!user || user.role !== "CLIENT" || user.deletedAt) throw createHttpError(404, "Customer not found.");
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    if (purpose === "SIGNUP" && user.phone === identifier) await prisma.customer.update({ where: { userId: user.id }, data: { phoneVerified: true } });
    return { verified: true, accessToken: signCustomerAccessToken(user.id), customerId: user.id };
  }

  async profile(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user || user.role !== "CLIENT" || user.deletedAt) throw createHttpError(404, "Customer not found.");
    return user;
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
}
