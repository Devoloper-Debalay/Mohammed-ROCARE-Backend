import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { CartController } from "./cart.controller";
import { requireCustomerAuth } from "../customer/customer.middleware";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { CartItemDto } from "./cart.dto";
const r=Router(),c=container.resolve(CartController); r.use(requireCustomerAuth); r.get("/",c.get); r.post("/items",dtoValidation(CartItemDto),c.add); r.patch("/items/:productId",dtoValidation(CartItemDto),c.update); r.delete("/items/:productId",c.remove); r.delete("/",c.clear); export default r;
