import crypto from "crypto";

// ── Generate token ────────────────────────────────────────────────────────────
export function generateUnsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", process.env.UNSUBSCRIBE_SECRET!)
    .update(email)
    .digest("hex");
}

// ── Verify token ──────────────────────────────────────────────────────────────
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(token,    "hex")
  );
}