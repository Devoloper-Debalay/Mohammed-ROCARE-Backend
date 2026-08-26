import {Router} from "express";import "../../container";import {container} from "tsyringe";import {ServiceRequestController} from "./service-request.controller";import {requireCustomerAuth} from "../customer/customer.middleware";import {requireVendorAuth} from "../auth/vendor/vendor-auth.middleware";import {requireAdminAuth} from "../../middlewares/admin-auth.middleware";import {dtoValidation} from "../../middlewares/dtoValidation";import {CreateServiceRequestDto,AssignServiceRequestDto} from "./service-request.dto";
const r=Router();const c=container.resolve(ServiceRequestController);
r.post("/",requireCustomerAuth,dtoValidation(CreateServiceRequestDto),c.create);r.get("/customer",requireCustomerAuth,c.mine);r.get("/customer/:id",requireCustomerAuth,c.detail);
r.get("/vendor",requireVendorAuth,c.vendorList);for(const a of ["accept","start","complete","deny"])r.patch(`/vendor/:id/${a}`,requireVendorAuth,c.vendorAction);
r.get("/admin",requireAdminAuth,c.adminList);r.patch("/admin/:id/assign",requireAdminAuth,dtoValidation(AssignServiceRequestDto),c.assign);
export default r;
