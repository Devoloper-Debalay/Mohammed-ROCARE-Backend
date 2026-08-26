import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { verifyCustomerAccessToken } from "./customer-token.util";

export const requireCustomerAuth: RequestHandler = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw createHttpError(401, "No customer token provided.");
    const token = header.slice(7);
    const payload = verifyCustomerAccessToken(token);
    res.locals.customerUserId = payload.userId;
    next();
  } catch (e) { next(e); }
};
