import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../config/database";
import { Role } from "../generated/prisma/enums";
import { verifyAdminAccessToken, AdminRole } from "../modules/auth/admin";

export type AdminPermission =
  | "VENDOR_READ"
  | "VENDOR_VERIFY"
  | "VENDOR_PUBLISH"
  | "VENDOR_UNBLOCK"
  | "VENDOR_ASSIGN_BRANCH"
  | "LEAD_READ"
  | "LEAD_PROOF_REVIEW"
  | "WALLET_ADJUST"
  | "ORDER_READ"
  | "ORDER_UPDATE"
  | "PAYMENT_READ"
  | "PAYMENT_REVIEW"
  | "PRODUCT_READ"
  | "PRODUCT_WRITE"
  | "SERVICE_READ"
  | "SERVICE_WRITE"
  | "COMPLAINT_READ"
  | "COMPLAINT_REPLY"
  | "REPORT_READ"
  | "SYSTEM_USERS"
  | "SYSTEM_ADMINS"
  | "SYSTEM_BRANCHES"
  | "SYSTEM_SETTINGS"
  | "SYSTEM_REPORTS";

/**
 * Permissions available to normal branch-scoped ADMINs.
 */
const ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  "VENDOR_READ",
  "VENDOR_VERIFY",
  "VENDOR_PUBLISH",
  "VENDOR_UNBLOCK",

  "LEAD_READ",
  "LEAD_PROOF_REVIEW",

  "WALLET_ADJUST",

  "ORDER_READ",
  "ORDER_UPDATE",

  "PAYMENT_READ",
  "PAYMENT_REVIEW",

  "PRODUCT_READ",
  "PRODUCT_WRITE",

  "SERVICE_READ",
  "SERVICE_WRITE",

  "COMPLAINT_READ",
  "COMPLAINT_REPLY",

  "REPORT_READ",
]);

/**
 * SADMIN has every permission.
 *
 * SADMIN is intentionally global and is NOT branch-scoped.
 */
const SUPER_ADMIN_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  ...ADMIN_PERMISSIONS,

  "VENDOR_ASSIGN_BRANCH",

  "SYSTEM_USERS",
  "SYSTEM_ADMINS",
  "SYSTEM_BRANCHES",
  "SYSTEM_SETTINGS",
  "SYSTEM_REPORTS",
]);

/**
 * Authenticate ADMIN or SADMIN.
 *
 * ADMIN:
 * - Must have an AdminProfile
 * - Must have branchId
 * - Is branch-scoped
 *
 * SADMIN:
 * - Does not require branchId
 * - Is globally scoped
 */
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw createHttpError(401, "No admin token provided.");
    }

    const token = header.substring("Bearer ".length).trim();

    if (!token) {
      throw createHttpError(401, "No admin token provided.");
    }

    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (blacklisted) {
      throw createHttpError(401, "Admin token has been invalidated.");
    }

    const payload = verifyAdminAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      include: {
        adminProfile: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user) {
      throw createHttpError(401, "Admin account is invalid.");
    }

    /**
     * Only ADMIN and SADMIN may use this authentication system.
     */
    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.SADMIN
    ) {
      throw createHttpError(403, "This account is not an admin.");
    }

    /**
     * Reject stale tokens when the role has changed.
     */
    if (user.role !== payload.role) {
      throw createHttpError(
        401,
        "Admin role is no longer valid. Please log in again.",
      );
    }

    if (!user.isActive) {
      throw createHttpError(401, "Admin account is inactive.");
    }

    if (user.deletedAt) {
      throw createHttpError(401, "Admin account has been deleted.");
    }

    /**
     * Normal ADMIN MUST belong to a branch.
     *
     * SADMIN NEVER requires a branch.
     */
    if (
      user.role === Role.ADMIN &&
      !user.adminProfile?.branchId
    ) {
      throw createHttpError(
        403,
        "Admin is not assigned to a branch.",
      );
    }

    /**
     * Authoritative access context.
     *
     * Never assign a branch scope to SADMIN.
     */
    res.locals.adminId = user.id;
    res.locals.adminRole = user.role;
    res.locals.adminBranchId =
      user.role === Role.ADMIN
        ? user.adminProfile?.branchId ?? null
        : null;

    res.locals.adminContext = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role authorization.
 *
 * IMPORTANT HIERARCHY:
 *
 * Route: requireAdminRole(Role.ADMIN)
 *   ADMIN  -> allowed
 *   SADMIN -> allowed
 *
 * Route: requireAdminRole(Role.SADMIN)
 *   ADMIN  -> denied
 *   SADMIN -> allowed
 *
 * Route: requireAdminRole(Role.ADMIN, Role.SADMIN)
 *   ADMIN  -> allowed
 *   SADMIN -> allowed
 */
export function requireAdminRole(...roles: Role[]) {
  return (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const role = res.locals.adminRole as Role | undefined;

    if (!role) {
      return next(
        createHttpError(401, "Admin authentication required."),
      );
    }

    /**
     * Explicit role access.
     */
    if (roles.includes(role)) {
      return next();
    }

    /**
     * SADMIN inherits every normal ADMIN route.
     *
     * ADMIN does NOT inherit SADMIN routes.
     */
    if (
      role === Role.SADMIN &&
      roles.includes(Role.ADMIN)
    ) {
      return next();
    }

    return next(
      createHttpError(
        403,
        `Insufficient admin role. Current role: ${role}`,
      ),
    );
  };
}

/**
 * Permission authorization.
 *
 * SADMIN has global administrative permissions.
 * ADMIN has normal administrative permissions.
 */
export function requireAdminPermission(
  permission: AdminPermission,
) {
  return (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const role = res.locals.adminRole as Role | undefined;

    if (!role) {
      return next(
        createHttpError(
          401,
          "Admin authentication required.",
        ),
      );
    }

    if (role === Role.SADMIN) {
      if (!SUPER_ADMIN_PERMISSIONS.has(permission)) {
        return next(
          createHttpError(
            403,
            `Permission denied: ${permission}.`,
          ),
        );
      }

      return next();
    }

    if (role === Role.ADMIN) {
      if (!ADMIN_PERMISSIONS.has(permission)) {
        return next(
          createHttpError(
            403,
            `Permission denied: ${permission}.`,
          ),
        );
      }

      return next();
    }

    return next(
      createHttpError(
        403,
        "Invalid admin role.",
      ),
    );
  };
}

/**
 * Branch-level ABAC authorization.
 *
 * SADMIN:
 * - Always allowed
 * - No branch filtering
 * - No branch comparison
 *
 * ADMIN:
 * - Must have an assigned branch
 * - Resource must belong to that branch
 */
export function assertAdminBranchAccess(
  res: Response,
  resourceBranchId: string | null | undefined,
): void {
  const role = res.locals.adminRole as Role | undefined;

  /**
   * SADMIN is GLOBAL.
   *
   * This return must happen BEFORE any branch validation.
   */
  if (role === Role.SADMIN) {
    return;
  }

  if (role !== Role.ADMIN) {
    throw createHttpError(
      403,
      "Invalid admin role.",
    );
  }

  const adminBranchId =
    res.locals.adminBranchId as
      | string
      | null
      | undefined;

  if (!adminBranchId) {
    throw createHttpError(
      403,
      "Admin is not assigned to a branch.",
    );
  }

  if (!resourceBranchId) {
    throw createHttpError(
      403,
      "Resource is not assigned to a branch.",
    );
  }

  if (adminBranchId !== resourceBranchId) {
    throw createHttpError(
      403,
      "Resource is outside your branch scope.",
    );
  }
}

/**
 * Use this helper when building Prisma `where` clauses.
 *
 * SADMIN -> {}
 * ADMIN  -> { branchId: assignedBranchId }
 *
 * This is useful for list queries.
 */
export function getAdminBranchScope(
  res: Response,
): Record<string, string> {
  const role = res.locals.adminRole as Role | undefined;

  /**
   * GLOBAL SADMIN.
   *
   * Empty Prisma filter means:
   * DO NOT FILTER BY BRANCH.
   */
  if (role === Role.SADMIN) {
    return {};
  }

  if (role !== Role.ADMIN) {
    throw createHttpError(
      403,
      "Invalid admin role.",
    );
  }

  const branchId =
    res.locals.adminBranchId as
      | string
      | null
      | undefined;

  if (!branchId) {
    throw createHttpError(
      403,
      "Admin is not assigned to a branch.",
    );
  }

  return {
    branchId,
  };
}