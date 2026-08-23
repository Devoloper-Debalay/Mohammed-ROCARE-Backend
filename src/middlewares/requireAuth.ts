import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import createHttpError from "http-errors";
import prisma from "../config/database";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createHttpError(401, "No token provided.");
    }

    const token = authHeader.split(" ")[1];

    // 1. Check if token is blacklisted
    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (blacklisted) {
      throw createHttpError(401, "Token has been invalidated. Please log in again.");
    }

    // 2. Verify signature and expiry
    const decoded = verify(token, process.env.JWT_SECRET_KEY as string) as any;

    (req as any).user = decoded;

    next();
  } catch (err) {
    next(err);
  }
}