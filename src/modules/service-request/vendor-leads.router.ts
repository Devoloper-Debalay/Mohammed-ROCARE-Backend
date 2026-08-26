import {Router} from "express";import "../../container";import {container} from "tsyringe";import {ServiceRequestController} from "./service-request.controller";import {requireVendorAuth} from "../auth/vendor/vendor-auth.middleware";
const r=Router(),c=container.resolve(ServiceRequestController);
r.use(requireVendorAuth);
r.get("/",c.vendorList);
for(const a of ["accept","start","complete","deny"])r.patch("/:id/"+a,c.vendorAction);
export default r;
