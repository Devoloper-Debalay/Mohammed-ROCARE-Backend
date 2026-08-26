import{Router}from"express";import{container}from"tsyringe";import{AnalyticsController}from"./analytics.controller";
import { Role } from "../../../generated/prisma/enums";
import { requireAdminAuth, requireAdminRole } from "../../auth/admin";
const r=Router(),c=container.resolve(AnalyticsController);r.use(requireAdminAuth,requireAdminRole(Role.SADMIN));r.get("/dashboard",c.dashboard);r.get("/analytics",c.trends);export default r;
