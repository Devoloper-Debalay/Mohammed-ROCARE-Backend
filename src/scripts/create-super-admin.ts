import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/enums";
import prisma from "../config/database";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const email = required("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = required("SUPER_ADMIN_PASSWORD");
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME?.trim() || "Super";
  const lastName = process.env.SUPER_ADMIN_LAST_NAME?.trim() || "Admin";
  const phone = process.env.SUPER_ADMIN_PHONE?.trim() || undefined;

  if (password.length < 1) throw new Error("SUPER_ADMIN_PASSWORD is required.");

  const hash = await bcrypt.hash(password, 12);
  // Look up by role rather than email: this lets SUPER_ADMIN_EMAIL change
  // (e.g. to update login credentials) and still update the existing
  // super admin account, instead of creating a duplicate under the new email.
  const existing = await prisma.user.findFirst({ where: { role: Role.SADMIN } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email, firstName, lastName, phone, password: hash, isActive: true, deletedAt: null },
    });
    await prisma.adminProfile.upsert({ where: { userId: existing.id }, update: {}, create: { userId: existing.id, jobTitle: "Super Administrator" } });
    console.log(`Super Admin updated: ${email}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      firstName, lastName, email, phone, password: hash, role: Role.SADMIN, isActive: true,
      adminProfile: { create: { jobTitle: "Super Administrator" } },
    },
  });

  await prisma.auditLog.create({
    data: { actorType: "SYSTEM", actorId: user.id, action: "SUPER_ADMIN_BOOTSTRAPPED", entityType: "User", entityId: user.id },
  });
  console.log(`Super Admin created: ${email}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
