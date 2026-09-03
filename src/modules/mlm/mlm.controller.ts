import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "tsyringe";
import { MlmService } from "./mlm.service";
import { CreateWithdrawalRequestDto, ReviewWithdrawalDto, CommissionQueryDto } from "./mlm.dto";
import { WithdrawalStatus } from "../../generated/prisma/enums";

@injectable()
export class MlmController {
  constructor(@inject(MlmService) private readonly mlmService: MlmService) {}

  // Customer / User MLM Dashboard
  customerDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).customerId;
      const data = await this.mlmService.getDashboard({ userId });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // Vendor MLM Dashboard
  vendorDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = (req as any).vendor?.id;
      const data = await this.mlmService.getDashboard({ vendorId });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // Genealogy Tree
  genealogyTree = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).customerId;
      const depth = Number(req.query.depth) || 3;
      const data = await this.mlmService.getGenealogyTree(userId, depth);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // User / Customer Commissions
  customerCommissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).customerId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const commissionType = req.query.commissionType as string;
      const data = await this.mlmService.getCommissions({ userId }, page, limit, commissionType);
      res.status(200).json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  };

  // Vendor Commissions
  vendorCommissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = (req as any).vendor?.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const commissionType = req.query.commissionType as string;
      const data = await this.mlmService.getCommissions({ vendorId }, page, limit, commissionType);
      res.status(200).json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  };

  // Customer Request Withdrawal
  customerWithdraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id || (req as any).customerId;
      const data = await this.mlmService.requestWithdrawal({
        userId,
        ...req.body,
      });
      res.status(201).json({ success: true, message: "Withdrawal request submitted.", data });
    } catch (err) {
      next(err);
    }
  };

  // Vendor Request Withdrawal
  vendorWithdraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = (req as any).vendor?.id;
      const data = await this.mlmService.requestWithdrawal({
        vendorId,
        ...req.body,
      });
      res.status(201).json({ success: true, message: "Withdrawal request submitted.", data });
    } catch (err) {
      next(err);
    }
  };

  // Admin List Withdrawals
  adminListWithdrawals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as WithdrawalStatus;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const data = await this.mlmService.listWithdrawals(status, page, limit);
      res.status(200).json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  };

  // Admin Review Withdrawal
  adminReviewWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { status, adminNote, transactionRef } = req.body;
      const data = await this.mlmService.reviewWithdrawal(id, status, adminNote, transactionRef);
      res.status(200).json({ success: true, message: `Withdrawal ${status.toLowerCase()} successfully.`, data });
    } catch (err) {
      next(err);
    }
  };
}
