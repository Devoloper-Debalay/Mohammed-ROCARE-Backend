import createHttpError from "http-errors";

/**
 * Normalizes a phone number to a simple E.164 representation.
 * If no country code is supplied, DEFAULT_PHONE_COUNTRY_CODE is used (default +91).
 */
export function normalizeVendorPhone(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) throw createHttpError(400, "Phone number is required.");

  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) {
      throw createHttpError(400, "Phone number must be a valid international number.");
    }
    return `+${digits}`;
  }

  const countryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE || "+91").replace(/\D/g, "");
  const localDigits = digits.replace(/^0+/, "");
  const normalized = `${countryCode}${localDigits}`;

  if (normalized.length < 8 || normalized.length > 15) {
    throw createHttpError(400, "Phone number must be a valid phone number.");
  }

  return `+${normalized}`;
}
