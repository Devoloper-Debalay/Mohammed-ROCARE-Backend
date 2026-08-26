import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { CartService } from "./cart.service";
import { sendSuccess } from "../../shared/response";
@injectable() export class CartController {
  constructor(@inject(CartService) private readonly service: CartService) {}
  get=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.service.get(res.locals.customerUserId),"Cart.")}catch(e){next(e)}};
  add=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.service.add(res.locals.customerUserId,req.body.productId,req.body.quantity),"Item added.",201)}catch(e){next(e)}};
  update=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.service.update(res.locals.customerUserId,req.params.productId as string,req.body.quantity),"Cart updated.")}catch(e){next(e)}};
  remove=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.service.remove(res.locals.customerUserId,req.params.productId as string),"Item removed.")}catch(e){next(e)}};
  clear=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.service.clear(res.locals.customerUserId),"Cart cleared.")}catch(e){next(e)}};
}
