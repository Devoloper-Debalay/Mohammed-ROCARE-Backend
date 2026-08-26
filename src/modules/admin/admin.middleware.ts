import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Role } from "../../generated/prisma/enums";
import { resolveUserFromToken } from "../../utils/resolveUserFromToken";

export const enforceAdminPanel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const found = await resolveUserFromToken(req);
    if (found.role !== Role.ADMIN && found.role !== Role.SADMIN) throw createHttpError(403, "Admin access required.");
    if (!found.isActive) throw createHttpError(403, "Your account has been deactivated.");
    res.locals.adminId = found.id;
    res.locals.adminRole = found.role;
    next();
  } catch (error) { next(error); }
};

export const enforceSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (res.locals.adminRole !== Role.SADMIN) return next(createHttpError(403, "Super Admin access required."));
  next();
};
