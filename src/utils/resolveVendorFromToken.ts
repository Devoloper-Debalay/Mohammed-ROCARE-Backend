import { Request } from "express";
import createHttpError from "http-errors";
import prisma from "../config/database";

// ── Shared helper ──────────────────────────────────────────────────────────────
// Assumes requireVendorAuth (or equivalent) already ran and set req.vendor
// from a verified JWT. This re-fetches the vendor row so role/status checks
// reflect the current DB state, not a possibly-stale token payload.
export const resolveVendorFromToken = async (req: Request) => {
  const vendor = req.vendor;

  if (!vendor) throw createHttpError(401, "Unauthorized - vendor token missing");

  const found = await prisma.vendor.findUnique({
    where: { id: vendor.vendorId },
    select: {
      id: true,
      role: true,
      verificationStatus: true,
      profileStatus: true,
      deletedAt: true,
    },
  });

  if (!found || found.deletedAt) throw createHttpError(401, "Invalid vendor token");

  return found;
};
