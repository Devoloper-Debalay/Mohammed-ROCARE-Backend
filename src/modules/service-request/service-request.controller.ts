import { injectable,inject } from "tsyringe"; import {Request,Response,NextFunction} from "express"; import {ServiceRequestService} from "./service-request.service"; import {sendSuccess} from "../../shared/response";
@injectable() export class ServiceRequestController{
 constructor(@inject(ServiceRequestService) private readonly s:ServiceRequestService){}
 create=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.create(res.locals.customerUserId,req.body),"Service request created.",201)}catch(e){next(e)}};
 mine=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.listForCustomer(res.locals.customerUserId,Number(req.query.page)||1,Number(req.query.limit)||20),"Service requests.")}catch(e){next(e)}};
 detail=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.detailForCustomer(res.locals.customerUserId,req.params.id as string),"Service request.")}catch(e){next(e)}};
 vendorList=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.listVendor(res.locals.vendorId,Number(req.query.page)||1,Number(req.query.limit)||20),"Vendor service requests.")}catch(e){next(e)}};
 vendorAction=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.updateVendor(res.locals.vendorId,req.params.id as string,req.params.action as any),"Service request updated.")}catch(e){next(e)}};
 adminList=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.adminList(Number(req.query.page)||1,Number(req.query.limit)||20),"Service requests.")}catch(e){next(e)}};
 assign=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.assign(res.locals.adminId,req.params.id as string,req.body.vendorId),"Service request assigned.")}catch(e){next(e)}};
}
