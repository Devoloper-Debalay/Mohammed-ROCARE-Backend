import { Router } from "express";
import "../../../container";
import { container } from "tsyringe";
import { dtoValidation } from "../../../middlewares/dtoValidation";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminLoginDto } from "./admin-auth.dto";
import { requireAdminAuth } from "../../../middlewares/admin-auth.middleware";

const router = Router();
const controller = container.resolve(AdminAuthController);

router.get("/branches", controller.branches);
router.post("/login", dtoValidation(AdminLoginDto), controller.login);
router.get("/me", requireAdminAuth, controller.me);

export default router;
