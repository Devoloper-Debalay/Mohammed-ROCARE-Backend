import {injectable,inject} from "tsyringe";import {Request,Response,NextFunction} from "express";import {PaymentService} from "./payment.service";import {sendSuccess} from "../../shared/response";
@injectable() export class PaymentController{constructor(@inject(PaymentService)private readonly s:PaymentService){}
 createOrder=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.createOrder(res.locals.customerUserId||res.locals.vendorId,req.body),"Razorpay order created.",201)}catch(e){next(e)}};
 verify=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.verify(res.locals.customerUserId||res.locals.vendorId,req.body),"Payment verified.")}catch(e){next(e)}};
 webhook=async(req:Request,res:Response,next:NextFunction)=>{try{const raw=(req as any).rawBody||JSON.stringify(req.body);sendSuccess(res,await this.s.webhook(raw,req.headers["x-razorpay-signature"] as string,req.body),"Webhook received.")}catch(e){next(e)}};
}
