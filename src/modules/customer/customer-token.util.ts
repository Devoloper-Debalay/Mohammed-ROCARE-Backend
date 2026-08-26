import { sign, verify, type JwtPayload } from "jsonwebtoken";
import createHttpError from "http-errors";

const secret = () => {
  const value = process.env.JWT_SECRET_KEY;
  if (!value) throw createHttpError(500, "JWT_SECRET_KEY is not configured.");
  return value;
};

export interface CustomerTokenPayload extends JwtPayload {
  userId: string;
  role: "CLIENT";
  tokenType: "CUSTOMER_ACCESS";
}

export function signCustomerAccessToken(userId: string): string {
  return sign({ userId, role: "CLIENT", tokenType: "CUSTOMER_ACCESS" }, secret(), {
    expiresIn: (process.env.JWT_CUSTOMER_ACCESS_EXPIRES_IN || "1d") as any,
    audience: "rocare-customer",
  });
}

export function verifyCustomerAccessToken(token: string): CustomerTokenPayload {
  try {
    const payload = verify(token, secret(), { audience: "rocare-customer" }) as CustomerTokenPayload;
    if (payload.tokenType !== "CUSTOMER_ACCESS" || payload.role !== "CLIENT") {
      throw createHttpError(401, "Invalid customer token.");
    }
    return payload;
  } catch (e) {
    if (createHttpError.isHttpError(e)) throw e;
    throw createHttpError(401, "Invalid or expired customer token.");
  }
}
