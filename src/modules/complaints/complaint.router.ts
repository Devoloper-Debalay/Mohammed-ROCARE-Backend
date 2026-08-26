import{Router}from"express";import"../../container";
import{container}from"tsyringe";
import{ComplaintController}from"./complaint.controller";
import{requireCustomerAuth}from"../customer/customer.middleware";
import{requireAdminAuth}from"../../middlewares/admin-auth.middleware";
import{dtoValidation}from"../../middlewares/dtoValidation";
import{ComplaintDto,ComplaintReplyDto}from"./complaint.dto";

const complaintsRouter=Router(),c=container.resolve(ComplaintController);

complaintsRouter.use("/customer",requireCustomerAuth);
complaintsRouter.post("/customer",dtoValidation(ComplaintDto),c.create);
complaintsRouter.get("/customer",c.mine);
complaintsRouter.get("/admin",requireAdminAuth,c.admin);
complaintsRouter.patch("/admin/:id",requireAdminAuth,dtoValidation(ComplaintReplyDto),c.reply);

export default complaintsRouter;
