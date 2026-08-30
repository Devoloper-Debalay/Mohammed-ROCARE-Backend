import { inject, injectable } from "tsyringe";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { Role } from "../../../generated/prisma/enums";
import { AdminAuthRepository } from "./admin-auth.repository";
import { signAdminAccessToken } from "./admin-auth.token";

@injectable()
export class AdminAuthService {
  constructor(@inject(AdminAuthRepository) private readonly repo: AdminAuthRepository) {}

  async login(email: string, password: string) {
    const user = await this.repo.findAdminByEmail(email);
    if (!user || !this.repo.isAdminRole(user.role) || !user.isActive || user.deletedAt) {
      throw createHttpError(401, "Invalid admin credentials.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw createHttpError(401, "Invalid admin credentials.");

    if (user.role === Role.ADMIN && !user.adminProfile?.branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }

    const accessToken = signAdminAccessToken(user.id, user.role);
    await this.repo.recordAudit({ actorType: "ADMIN", actorId: user.id, action: "ADMIN_LOGIN", entityType: "User", entityId: user.id });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        branch: user.adminProfile?.branch ?? null,
      },
    };
  }

  async listBranches() {
    return this.repo.listActiveBranches();
  }

  async me(userId: string) {
    const user = await this.repo.findAdminById(userId);
    if (!user || !this.repo.isAdminRole(user.role) || !user.isActive || user.deletedAt) {
      throw createHttpError(403, "Admin account is inactive or unavailable.");
    }
    if (user.role === Role.ADMIN && !user.adminProfile?.branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }
    return user;
  }
}
