import{Router}from"express";import"../../container";
import{container}from"tsyringe";
import{ComplaintController}from"./complaint.controller";
import{requireCustomerAuth}from"../customer/customer.middleware";
import{requireAdminAuth,requireAdminRole}from"../../middlewares/admin-auth.middleware";
import{dtoValidation}from"../../middlewares/dtoValidation";
import{ComplaintDto,ComplaintReplyDto}from"./complaint.dto";import{Role}from"../../generated/prisma/enums";

const complaintsRouter=Router(),c=container.resolve(ComplaintController);

complaintsRouter.use("/customer",requireCustomerAuth);
complaintsRouter.post("/customer",dtoValidation(ComplaintDto),c.create);
complaintsRouter.get("/customer",c.mine);
complaintsRouter.get("/admin",requireAdminAuth,requireAdminRole(Role.ADMIN,Role.SADMIN),c.admin);
complaintsRouter.patch("/admin/:id",requireAdminAuth,requireAdminRole(Role.ADMIN,Role.SADMIN),dtoValidation(ComplaintReplyDto),c.reply);

export default complaintsRouter;
