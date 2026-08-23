import { Request, Response, NextFunction } from "express";
import { resolveUserFromToken } from "../utils/resolveUserFromToken";
import createHttpError from "http-errors";
import { Role } from "../generated/prisma/enums";

export const enforceAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const found = await resolveUserFromToken(req);

    if (found.role !== Role.ADMIN || Role.SADMIN)
      throw createHttpError(403, "Admins only.");

    if (!found.isActive)
      throw createHttpError(403, "Your account has been deactivated. Please contact support.");

    res.locals.adminId = found.id;
    res.locals.userId  = found.id;

    next();
  } catch (err) {
    next(err);
  }
};