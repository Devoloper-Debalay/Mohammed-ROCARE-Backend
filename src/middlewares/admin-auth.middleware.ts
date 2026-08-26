import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../config/database";
import { Role } from "../generated/prisma/enums";
import { verifyAdminAccessToken, AdminRole } from "../modules/auth/admin";


export type AdminPermission =
  | "VENDOR_READ" | "VENDOR_VERIFY" | "VENDOR_PUBLISH" | "VENDOR_UNBLOCK" | "VENDOR_ASSIGN_BRANCH"
  | "LEAD_READ" | "LEAD_PROOF_REVIEW"
  | "WALLET_ADJUST"
  | "ORDER_READ" | "ORDER_UPDATE"
  | "PAYMENT_READ" | "PAYMENT_REVIEW"
  | "PRODUCT_READ" | "PRODUCT_WRITE"
  | "SERVICE_READ" | "SERVICE_WRITE"
  | "COMPLAINT_READ" | "COMPLAINT_REPLY"
  | "REPORT_READ"
  | "SYSTEM_USERS" | "SYSTEM_ADMINS" | "SYSTEM_BRANCHES" | "SYSTEM_SETTINGS" | "SYSTEM_REPORTS";

const ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  "VENDOR_READ", "VENDOR_VERIFY", "VENDOR_PUBLISH", "VENDOR_UNBLOCK",
  "LEAD_READ", "LEAD_PROOF_REVIEW", "WALLET_ADJUST",
  "ORDER_READ", "ORDER_UPDATE", "PAYMENT_READ", "PAYMENT_REVIEW",
  "PRODUCT_READ", "PRODUCT_WRITE", "SERVICE_READ", "SERVICE_WRITE",
  "COMPLAINT_READ", "COMPLAINT_REPLY", "REPORT_READ",
]);

const SUPER_ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ...ADMIN_PERMISSIONS,
  "VENDOR_ASSIGN_BRANCH", "SYSTEM_USERS", "SYSTEM_ADMINS", "SYSTEM_BRANCHES",
  "SYSTEM_SETTINGS", "SYSTEM_REPORTS",
]);

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw createHttpError(401, "No admin token provided.");
    const token = header.slice("Bearer ".length).trim();
    if (!token) throw createHttpError(401, "No admin token provided.");

    const blacklisted = await prisma.blacklistedToken.findUnique({ where: { token } });
    if (blacklisted) throw createHttpError(401, "Admin token has been invalidated.");

    const payload = verifyAdminAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { adminProfile: { include: { branch: true } } },
    });

    if (!user || user.role !== payload.role || !user.isActive || user.deletedAt) {
      throw createHttpError(401, "Admin account is invalid or inactive.");
    }
    if (user.role === Role.ADMIN && !user.adminProfile?.branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }

    res.locals.adminId = user.id;
    res.locals.adminRole = user.role;
    res.locals.adminBranchId = user.adminProfile?.branchId ?? null;
    res.locals.adminContext = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdminRole(...roles: AdminRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const role = res.locals.adminRole as Role | undefined;
    if (!role || !roles.includes(role as AdminRole)) {
      return next(createHttpError(403, "Insufficient admin role."));
    }
    next();
  };
}

export function requireAdminPermission(permission: AdminPermission) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const role = res.locals.adminRole as Role | undefined;
    const permissions = role === Role.SADMIN ? SUPER_ADMIN_PERMISSIONS : ADMIN_PERMISSIONS;
    if (!role || !permissions.has(permission)) {
      return next(createHttpError(403, `Permission denied: ${permission}.`));
    }
    next();
  };
}

/** ABAC helper: ADMIN may access only its own branch; SADMIN may access any branch. */
export function assertAdminBranchAccess(res: Response, resourceBranchId: string | null | undefined): void {
  const role = res.locals.adminRole as Role | undefined;
  const adminBranchId = res.locals.adminBranchId as string | null | undefined;
  if (role === Role.SADMIN) return;
  if (role !== Role.ADMIN || !adminBranchId || !resourceBranchId || adminBranchId !== resourceBranchId) {
    throw createHttpError(403, "Resource is outside your branch scope.");
  }
}
