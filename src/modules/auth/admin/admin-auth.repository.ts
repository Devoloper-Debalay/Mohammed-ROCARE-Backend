import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";

@injectable()
export class AdminAuthRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  findAdminByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  findAdminById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: { include: { branch: true } } },
    });
  }

  recordAudit(data: { actorType: string; actorId?: string; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }) {
    return this.prisma.auditLog.create({ data: { ...data, metadata: data.metadata as any } });
  }

  listActiveBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true,
      },
    });
  }

  isAdminRole(role: Role): role is Extract<Role, "ADMIN" | "SADMIN"> {
    return role === Role.ADMIN || role === Role.SADMIN;
  }
}
