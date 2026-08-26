import {Request,Response,NextFunction} from "express";import {inject,injectable} from "tsyringe";import {OrderService} from "./order.service";import {sendSuccess} from "../../shared/response";
@injectable() export class OrderController{constructor(@inject(OrderService)private readonly s:OrderService){}
 checkout=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.checkout(res.locals.customerUserId,req.body),"Order placed.",201)}catch(e){n(e)}};
 buyNow=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.buyNow(res.locals.customerUserId,req.body),"Order placed.",201)}catch(e){n(e)}};
 mine=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.listMine(res.locals.customerUserId,Number(req.query.page)||1,Math.min(Number(req.query.limit)||20,100)),"Orders.")}catch(e){n(e)}};
 detail=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.detailMine(res.locals.customerUserId,req.params.id as string),"Order.")}catch(e){n(e)}};
 cancel=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.cancel(res.locals.customerUserId,req.params.id as string),"Order cancelled.")}catch(e){n(e)}};
 admin=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.adminList(Number(req.query.page)||1,Math.min(Number(req.query.limit)||20,100),res.locals.adminBranchId),"Orders.")}catch(e){n(e)}};
 status=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.adminStatus(req.params.id as string,req.body.status,req.body.completionPhoto),"Order status updated.")}catch(e){n(e)}};
 assign=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.assignVendor(req.params.id as string,req.body.vendorId),"Vendor assigned.")}catch(e){n(e)}};
 vendor=async(req:Request,res:Response,n:NextFunction)=>{try{sendSuccess(res,await this.s.vendorList(res.locals.vendorId,Number(req.query.page)||1,Math.min(Number(req.query.limit)||20,100)),"Assigned orders.")}catch(e){n(e)}};
}
