import {injectable,inject} from "tsyringe";import {Request,Response,NextFunction} from "express";import {WalletService} from "./wallet.service";import {sendSuccess} from "../../shared/response";
@injectable() export class WalletController{constructor(@inject(WalletService)private readonly s:WalletService){}
 get=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.get(res.locals.vendorId),"Wallet.")}catch(e){next(e)}};
 history=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.history(res.locals.vendorId,Number(req.query.page)||1,Number(req.query.limit)||20),"Wallet history.")}catch(e){next(e)}};
 withdraw=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.withdraw(res.locals.vendorId,req.body.amount,req.body.note),"Withdrawal requested.",201)}catch(e){next(e)}};
 issue=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.issue(res.locals.vendorId,req.body.subject,req.body.description),"Wallet issue created.",201)}catch(e){next(e)}};
}
