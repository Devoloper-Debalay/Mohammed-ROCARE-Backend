import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { ServiceRequestController } from "./service-request.controller";
import { requireCustomerAuth } from "../customer/customer.middleware";
import { requireVendorAuth } from "../auth/vendor/vendor-auth.middleware";
import { requireAdminAuth } from "../../middlewares/admin-auth.middleware";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { CreateServiceRequestDto, AssignServiceRequestDto } from "./service-request.dto";

const r = Router();
const c = container.resolve(ServiceRequestController);

// Customer creates a service request. Creation also creates an OPEN NEW lead.
r.post("/", requireCustomerAuth, dtoValidation(CreateServiceRequestDto), c.create);
r.get("/customer", requireCustomerAuth, c.mine);
r.get("/customer/:id", requireCustomerAuth, c.detail);

// Vendor can inspect requests assigned through a purchased lead.
// State-changing vendor actions intentionally live in /vendor/leads/:leadId/*
// so a vendor cannot bypass lead purchase by accepting a ServiceRequest directly.
r.get("/vendor", requireVendorAuth, c.vendorList);

r.get("/admin", requireAdminAuth, c.adminList);
// Manual assignment is retained only for administrative exceptions. Normal flow is vendor purchase.
r.patch("/admin/:id/assign", requireAdminAuth, dtoValidation(AssignServiceRequestDto), c.assign);

export default r;
