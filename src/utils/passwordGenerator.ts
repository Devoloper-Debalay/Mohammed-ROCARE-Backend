import crypto from "crypto";

export function generateRandomPassword(length = 12): string {
  // avoids ambiguous chars like 0/O, 1/l for readability if user ever needs to type it
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}