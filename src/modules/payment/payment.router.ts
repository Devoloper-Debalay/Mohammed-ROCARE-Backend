import {Router} from "express";import "../../container";import {container} from "tsyringe";import {PaymentController} from "./payment.controller";import {requireCustomerAuth} from "../customer/customer.middleware";import {requireVendorAuth} from "../auth/vendor/vendor-auth.middleware";import {dtoValidation} from "../../middlewares/dtoValidation";import {CreateOrderDto,VerifyPaymentDto} from "./payment.dto";
const r=Router(),c=container.resolve(PaymentController);
r.post("/create-order",requireCustomerAuth,dtoValidation(CreateOrderDto),c.createOrder);
r.post("/verify",requireCustomerAuth,dtoValidation(VerifyPaymentDto),c.verify);
r.post("/webhook",c.webhook);
export default r;
