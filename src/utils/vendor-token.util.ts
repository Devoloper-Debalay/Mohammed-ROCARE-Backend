import { sign, verify, JwtPayload, SignOptions } from "jsonwebtoken";
import createHttpError from "http-errors";

/**
 * Vendor JWTs are deliberately kept separate from other application tokens
 * when a vendor-specific secret is configured. The shared secret fallback
 * keeps this module compatible with existing deployments.
 */
const ACCESS_SECRET = process.env.JWT_VENDOR_SECRET_KEY || process.env.JWT_SECRET_KEY;
const REFRESH_SECRET = process.env.JWT_VENDOR_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY;

const ACCESS_EXPIRES_IN = (process.env.JWT_VENDOR_ACCESS_EXPIRES_IN || process.env.EXPIRES_IN || "1h") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_VENDOR_REFRESH_EXPIRES_IN || "30d") as SignOptions["expiresIn"];

const ISSUER = process.env.JWT_VENDOR_ISSUER || "vendor-auth";
const AUDIENCE = process.env.JWT_VENDOR_AUDIENCE || "vendor-api";

export interface VendorJwtPayload extends JwtPayload {
  vendorId: string;
  role: string;
  tokenType: "access" | "refresh";
  exp?: number;
}

function getAccessSecret(): string {
  if (!ACCESS_SECRET) throw createHttpError(500, "Vendor JWT access secret is not configured.");
  return ACCESS_SECRET;
}

function getRefreshSecret(): string {
  if (!REFRESH_SECRET) throw createHttpError(500, "Vendor JWT refresh secret is not configured.");
  return REFRESH_SECRET;
}

function baseClaims(vendorId: string, role: string) {
  return { vendorId, role };
}

export function signVendorAccessToken(vendorId: string, role: string): string {
  return sign(
    { ...baseClaims(vendorId, role), tokenType: "access" },
    getAccessSecret(),
    { expiresIn: ACCESS_EXPIRES_IN, issuer: ISSUER, audience: AUDIENCE }
  );
}

export function signVendorRefreshToken(vendorId: string, role: string): string {
  return sign(
    { ...baseClaims(vendorId, role), tokenType: "refresh" },
    getRefreshSecret(),
    { expiresIn: REFRESH_EXPIRES_IN, issuer: ISSUER, audience: AUDIENCE }
  );
}

function verifyToken(token: string, secret: string, expectedType: VendorJwtPayload["tokenType"]): VendorJwtPayload {
  try {
    const decoded = verify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as VendorJwtPayload;

    if (!decoded.vendorId || !decoded.role || decoded.tokenType !== expectedType) {
      throw new Error("Invalid vendor token claims");
    }

    return decoded;
  } catch {
    throw createHttpError(
      401,
      expectedType === "access"
        ? "Invalid or expired vendor access token."
        : "Invalid or expired vendor refresh token."
    );
  }
}

export function verifyVendorAccessToken(token: string): VendorJwtPayload {
  return verifyToken(token, getAccessSecret(), "access");
}

export function verifyVendorRefreshToken(token: string): VendorJwtPayload {
  return verifyToken(token, getRefreshSecret(), "refresh");
}

export function getVendorTokenExpiry(token: string, type: "access" | "refresh"): Date {
  const decoded = type === "access"
    ? verifyVendorAccessToken(token)
    : verifyVendorRefreshToken(token);

  if (!decoded.exp) throw createHttpError(401, "Token has no expiry.");
  return new Date(decoded.exp * 1000);
}