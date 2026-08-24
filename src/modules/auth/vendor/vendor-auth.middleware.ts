import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { container } from "tsyringe";
import { VendorRepository } from "../../vendor/vendor.repository";
import prisma from "../../../config/database";
import { verifyVendorAccessToken } from "./vendor-token.util";

export async function requireVendorAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw createHttpError(401, "Authentication required. Provide a Bearer access token.");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) throw createHttpError(401, "Authentication token is missing.");

    const blacklisted = await prisma.blacklistedToken.findUnique({ where: { token } });
    if (blacklisted && blacklisted.expiresAt > new Date()) {
      throw createHttpError(401, "Token has been invalidated. Please log in again.");
    }

    const decoded = verifyVendorAccessToken(token);
    const vendorRepo = container.resolve(VendorRepository);
    const vendor = await vendorRepo.findById(decoded.vendorId);

    if (!vendor || vendor.deletedAt) {
      throw createHttpError(401, "Vendor account is no longer available.");
    }

    req.vendor = { vendorId: vendor.id, role: vendor.role };
    next();
  } catch (err) {
    next(err);
  }
}
