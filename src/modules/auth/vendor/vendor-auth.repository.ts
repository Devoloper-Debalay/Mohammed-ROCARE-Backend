import { injectable, inject } from "tsyringe";
import { randomInt, createHash } from "crypto";
import type {
  OtpPurpose,
  PrismaClient,
} from "../../../generated/prisma/client";
import createHttpError from "http-errors";
import { isEmail } from "class-validator";
import { normalizeIdentifier } from "../../../utils/auth.util";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS_PER_WINDOW = 3;
const OTP_WINDOW_MS = 60 * 1000; // 1 minute

const hashOtp = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

@injectable()
export class VendorAuthRepository {
  constructor(
    @inject("PrismaClient")
    private readonly prisma: PrismaClient
  ) {}

  // ---------------- OTP ----------------

  async createOtp(
    inputIdentifier: string,
    purpose: OtpPurpose
  ): Promise<string> {
    const identifier = normalizeIdentifier(inputIdentifier);

    const since = new Date(Date.now() - OTP_WINDOW_MS);

    const recentCount = await this.prisma.otpCode.count({
      where: {
        identifier,
        purpose,
        createdAt: {
          gte: since,
        },
      },
    });

    if (recentCount >= OTP_MAX_ATTEMPTS_PER_WINDOW) {
      throw createHttpError(
        429,
        "OTP request limit exceeded. Please try again later."
      );
    }

    const code = String(randomInt(100000, 1000000));

    await this.prisma.otpCode.create({
      data: {
        identifier,
        purpose,
        code: hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    return code;
  }

  async findValidOtp(
    inputIdentifier: string,
    code: string,
    purpose: OtpPurpose
  ) {
    const identifier = normalizeIdentifier(inputIdentifier);

    return this.prisma.otpCode.findFirst({
      where: {
        identifier,
        purpose,
        code: hashOtp(code),
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  markOtpUsed(id: string) {
    return this.prisma.otpCode.update({
      where: { id },
      data: { used: true },
    });
  }

  // ---------------- Vendor ----------------

  async findVendorByIdentifier(inputIdentifier: string) {
    const identifier = normalizeIdentifier(inputIdentifier);

    return this.prisma.vendor.findFirst({
      where: isEmail(identifier)
        ? { email: identifier }
        : { phone: identifier },
      include: {
        bankDetail: true,
        kyc: true,
      },
    });
  }

  // ---------------- Token Blacklist ----------------

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const entry = await this.prisma.blacklistedToken.findUnique({
      where: { token },
    });

    return Boolean(entry && entry.expiresAt > new Date());
  }

  blacklistToken(token: string, expiresAt: Date) {
    return this.prisma.blacklistedToken.upsert({
      where: { token },
      create: { token, expiresAt },
      update: { expiresAt },
    });
  }

  cleanupExpiredTokens() {
    return this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}