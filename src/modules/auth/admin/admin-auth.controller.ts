import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { sendSuccess } from "../../../shared/response";
import { AdminAuthService } from "./admin-auth.service";

@injectable()
export class AdminAuthController {
  constructor(@inject(AdminAuthService) private readonly service: AdminAuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.login(req.body.email, req.body.password), "Admin login successful.");
    } catch (error) {
      next(error);
    }
  };

  branches = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.listBranches(), "Branches fetched.");
    } catch (error) {
      next(error);
    }
  };

  me = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.me(res.locals.adminId as string), "Admin context fetched.");
    } catch (error) {
      next(error);
    }
  };
}
