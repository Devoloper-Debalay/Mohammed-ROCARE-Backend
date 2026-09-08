import { Request, Response, NextFunction, RequestHandler } from "express";
import createHttpError from "http-errors";
import { resolveVendorFromToken } from "../utils/resolveVendorFromToken";
import { VendorRole, VendorProfileStatus, VendorVerificationStatus } from "../generated/prisma/enums";

/**
 * Role-gated vendor middleware. Must run AFTER requireVendorAuth (needs
 * req.vendor already set from a verified token).
 *
 * Usage:
 *   vendorRouter.use(requireVendorAuth);
 *   vendorRouter.get("/jobs", enforceVendor(VendorRole.TECHNICIAN), controller.listJobs);
 *   vendorRouter.get("/leads", enforceVendor(), controller.listLeads); // any verified vendor role
 */
export function enforceVendor(...allowedRoles: VendorRole[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const found = await resolveVendorFromToken(req);

      if (found.profileStatus === VendorProfileStatus.BLOCKED) {
        throw createHttpError(403, "Your vendor account has been blocked. Please contact support.");
      }
      if (found.profileStatus === VendorProfileStatus.DELETED) {
        throw createHttpError(403, "This vendor account no longer exists.");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(found.role)) {
        throw createHttpError(403, `Access restricted to: ${allowedRoles.join(", ")}.`);
      }

      res.locals.vendorId = found.id;
      res.locals.vendorRole = found.role;

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Gate for actions that only an admin-approved vendor may perform (accepting/
 * working leads, purchasing products/parts, etc). Login itself doesn't require
 * approval — a pending vendor can sign in and browse/complete their profile —
 * so this is what actually blocks "doing" until admin verification + publish.
 * Must run AFTER requireVendorAuth (needs req.vendor already set).
 */
export function requireApprovedVendor(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const found = await resolveVendorFromToken(req);

      if (found.profileStatus === VendorProfileStatus.BLOCKED) {
        throw createHttpError(403, "Your vendor account has been blocked. Please contact support.");
      }
      if (found.profileStatus === VendorProfileStatus.DELETED) {
        throw createHttpError(403, "This vendor account no longer exists.");
      }

      if (
        found.verificationStatus !== VendorVerificationStatus.VERIFIED ||
        found.profileStatus !== VendorProfileStatus.PUBLISHED
      ) {
        throw createHttpError(
          403,
          "Your account is pending admin approval. Complete your profile & KYC and wait for verification before you can do this."
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
