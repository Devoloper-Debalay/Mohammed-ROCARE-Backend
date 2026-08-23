import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../config/database";


// ── Shared helper ──────────────────────────────────────────────────────────────
export const resolveUserFromToken = async (req: Request) => {
  const user = req.user as any;

  if (!user) throw createHttpError(401, "Unauthorized - Token missing");

  const tokenUserId = user.userId || user.id || user.sub;

  const found = await prisma.user.findUnique({
    where: { id: tokenUserId },
    select: { id: true, role: true, isActive: true },
  });

  if (!found) throw createHttpError(401, "Invalid token user");

  return found;
};