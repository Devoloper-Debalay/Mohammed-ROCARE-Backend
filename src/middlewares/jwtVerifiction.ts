import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { verify } from "jsonwebtoken";

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!(authHeader && authHeader.startsWith("Bearer "))) {
    next(createHttpError(401, "Invalid Token"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verify(token, process.env.JWT_SECRET_KEY as string);
    
    (req as any).user = decoded;

    next();
  } catch (error) {
    next(createHttpError(401, "Invalid Token"));
  }
}
