import { JwtPayload, sign, verify } from "jsonwebtoken";
import createHttpError from "http-errors";
import { Role } from "../../../generated/prisma/enums";
import { StringValue } from "ms";

export type AdminRole = Extract<Role, "ADMIN" | "SADMIN">;
const ADMIN_ACCESS_EXPIRES_IN: StringValue =
  (process.env.JWT_ADMIN_ACCESS_EXPIRES_IN as StringValue) || "1d";

export interface AdminAccessTokenPayload extends JwtPayload {
  userId: string;
  role: AdminRole;
  tokenType: "ADMIN_ACCESS";
  aud: "just24you-admin";
}

function accessSecret(): string {
  const secret = process.env.JWT_ADMIN_SECRET_KEY;
  if (!secret) throw createHttpError(500, "JWT_ADMIN_SECRET_KEY is not configured.");
  return secret;
}

export function signAdminAccessToken(
  userId: string,
  role: AdminRole
): string {
  return sign(
    {
      userId,
      role,
      tokenType: "ADMIN_ACCESS",
    },
    accessSecret(),
    {
      expiresIn: ADMIN_ACCESS_EXPIRES_IN,
      audience: "just24you-admin",
    }
  );
}

export function verifyAdminAccessToken(token: string): AdminAccessTokenPayload {
  try {
    const payload = verify(token, accessSecret(), { audience: "just24you-admin" }) as AdminAccessTokenPayload;
    if (payload.tokenType !== "ADMIN_ACCESS" || (payload.role !== Role.ADMIN && payload.role !== Role.SADMIN)) {
      throw createHttpError(401, "Invalid admin token.");
    }
    return payload;
  } catch (error) {
    if (createHttpError.isHttpError(error)) throw error;
    throw createHttpError(401, "Invalid or expired admin token.");
  }
}
