import { normalizeVendorPhone } from "../modules/auth/vendor/vendor-phone.util";

export const isEmail = (identifier: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

export const normalizeIdentifier = (identifier: string): string => {
  const value = identifier.trim();

  return isEmail(value)
    ? value.toLowerCase()
    : normalizeVendorPhone(value);
};