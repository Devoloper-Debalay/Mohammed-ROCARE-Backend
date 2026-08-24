import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: any;
      // Set by the vendor auth middleware only — kept separate from `user`
      // because vendor auth is an independent token/identity, not a User row.
      vendor?: {
        vendorId: string;
        role: string;
      };
    }
  }
}
