import { injectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CustomerService } from "./customer.service";
import { sendSuccess } from "../../shared/response";

@injectable()
export class CustomerController {
  constructor(@inject(CustomerService) private readonly service: CustomerService) {}

  signup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.signup(req.body), "Customer signup successful.", 201);
    } catch (e) {
      next(e);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.login(req.body.identifier, req.body.password), "Customer login successful.");
    } catch (e) {
      next(e);
    }
  };

  getSecurityQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = String(req.query.identifier || req.body.identifier || "");
      sendSuccess(res, await this.service.getSecurityQuestion(identifier), "Security question retrieved.");
    } catch (e) {
      next(e);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.resetPassword(
        req.body.identifier,
        req.body.securityAnswer,
        req.body.newPassword
      );
      sendSuccess(res, result, "Password reset successful.");
    } catch (e) {
      next(e);
    }
  };

  /*
  // OTP handlers commented out
  sendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.sendOtp(req.body.identifier, req.body.purpose), "OTP sent.");
    } catch (e) {
      next(e);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.verifyOtp(req.body.identifier, req.body.code, req.body.purpose), "OTP verified.");
    } catch (e) {
      next(e);
    }
  };
  */

  profile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.profile(res.locals.customerUserId), "Customer profile.");
    } catch (e) {
      next(e);
    }
  };

  addresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.addresses(res.locals.customerUserId), "Addresses.");
    } catch (e) {
      next(e);
    }
  };

  addAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.addAddress(res.locals.customerUserId, req.body), "Address added.", 201);
    } catch (e) {
      next(e);
    }
  };

  updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.service.updateAddress(res.locals.customerUserId, req.params.id as string, req.body), "Address updated.");
    } catch (e) {
      next(e);
    }
  };

  deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteAddress(res.locals.customerUserId, req.params.id as string);
      sendSuccess(res, undefined, "Address deleted.");
    } catch (e) {
      next(e);
    }
  };

  createLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.service.createLead(res.locals.customerUserId, req.body),
        "Lead submitted successfully.",
        201
      );
    } catch (e) {
      next(e);
    }
  };
}
