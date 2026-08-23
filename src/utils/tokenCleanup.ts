import prisma from "../config/database";

export async function cleanupExpiredTokens() {
  const deleted = await prisma.blacklistedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.log(`Cleaned up ${deleted.count} expired blacklisted tokens`);
}

// Run every 12 hours
export function scheduleTokenCleanup() {
  cleanupExpiredTokens(); // run once on start
  setInterval(cleanupExpiredTokens, 12 * 60 * 60 * 1000);
}