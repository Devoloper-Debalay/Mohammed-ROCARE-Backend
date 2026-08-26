import {injectable,inject} from "tsyringe";import {Request,Response,NextFunction} from "express";import {NotificationService} from "./notification.service";import {sendSuccess} from "../../shared/response";
@injectable() export class NotificationController{constructor(@inject(NotificationService)private readonly s:NotificationService){}
 user=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.listUser(res.locals.customerUserId,Number(req.query.page)||1,Number(req.query.limit)||20),"Notifications.")}catch(e){next(e)}};
 vendor=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.listVendor(res.locals.vendorId,Number(req.query.page)||1,Number(req.query.limit)||20),"Notifications.")}catch(e){next(e)}};
 readUser=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.markRead(req.params.id as string,{userId:res.locals.customerUserId}),"Notification marked read.")}catch(e){next(e)}};
 readVendor=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.markRead(req.params.id as string,{vendorId:res.locals.vendorId}),"Notification marked read.")}catch(e){next(e)}};
}
