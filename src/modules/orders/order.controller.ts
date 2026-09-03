import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { OrderService } from "./order.service";
import { sendSuccess } from "../../shared/response";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums";

@injectable()
export class OrderController {
  constructor(@inject(OrderService) private readonly s: OrderService) {}

  checkout = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const userId = res.locals.customerUserId || (req as any).user?.id;
      sendSuccess(res, await this.s.checkout(userId, req.body), "Order placed.", 201);
    } catch (e) {
      n(e);
    }
  };

  buyNow = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const userId = res.locals.customerUserId || (req as any).user?.id;
      sendSuccess(res, await this.s.buyNow(userId, req.body), "Order placed.", 201);
    } catch (e) {
      n(e);
    }
  };

  mine = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const userId = res.locals.customerUserId || (req as any).user?.id;
      sendSuccess(
        res,
        await this.s.listMine(
          userId,
          Number(req.query.page) || 1,
          Math.min(Number(req.query.limit) || 20, 100)
        ),
        "Orders."
      );
    } catch (e) {
      n(e);
    }
  };

  detail = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const userId = res.locals.customerUserId || (req as any).user?.id;
      sendSuccess(res, await this.s.detailMine(userId, req.params.id as string), "Order.");
    } catch (e) {
      n(e);
    }
  };

  cancel = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const userId = res.locals.customerUserId || (req as any).user?.id;
      sendSuccess(res, await this.s.cancel(userId, req.params.id as string), "Order cancelled.");
    } catch (e) {
      n(e);
    }
  };

  admin = async (req: Request, res: Response, n: NextFunction) => {
    try {
      const branchId = res.locals.adminRole === "SADMIN" ? (req.query.branchId as string) : res.locals.adminBranchId;
      sendSuccess(
        res,
        await this.s.adminList({
          page: Number(req.query.page) || 1,
          limit: Math.min(Number(req.query.limit) || 20, 100),
          branchId,
          status: req.query.status as OrderStatus,
          paymentStatus: req.query.paymentStatus as PaymentStatus,
          search: req.query.search as string,
        }),
        "Orders."
      );
    } catch (e) {
      n(e);
    }
  };

  adminDetail = async (req: Request, res: Response, n: NextFunction) => {
    try {
      sendSuccess(res, await this.s.adminDetail(req.params.id as string), "Order detail.");
    } catch (e) {
      n(e);
    }
  };

  status = async (req: Request, res: Response, n: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.s.adminStatus(req.params.id as string, req.body.status, req.body.completionPhoto),
        "Order status updated."
      );
    } catch (e) {
      n(e);
    }
  };

  paymentStatus = async (req: Request, res: Response, n: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.s.adminPaymentStatus(
          req.params.id as string,
          req.body.paymentStatus,
          req.body.transactionId
        ),
        "Payment status updated."
      );
    } catch (e) {
      n(e);
    }
  };

  assign = async (req: Request, res: Response, n: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.s.assignVendor(req.params.id as string, req.body.vendorId),
        "Vendor assigned."
      );
    } catch (e) {
      n(e);
    }
  };

  vendor = async (req: Request, res: Response, n: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.s.vendorList(
          res.locals.vendorId,
          Number(req.query.page) || 1,
          Math.min(Number(req.query.limit) || 20, 100)
        ),
        "Assigned orders."
      );
    } catch (e) {
      n(e);
    }
  };
}
