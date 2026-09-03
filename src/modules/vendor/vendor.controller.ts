import { injectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { VendorService } from "./vendor.service";
import { sendSuccess } from "../../shared/response";
import { page, limit } from "../../shared/pagination";

function getVendorId(req: Request): string {
  const vendorId = req.vendor?.vendorId;
  if (!vendorId) throw createHttpError(401, "Unauthenticated vendor request.");
  return vendorId;
}

@injectable()
export class VendorController {
  constructor(@inject(VendorService) private readonly vendorService: VendorService) {}

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = getVendorId(req);
      const profile = await this.vendorService.getProfile(vendorId);
      sendSuccess(res, profile, "Vendor profile fetched.");
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vendorCode: _ignoredVendorCode, ...profileData } = req.body;
      const profile = await this.vendorService.updateProfileByVendorId(getVendorId(req), profileData);
      sendSuccess(res, profile, "Vendor profile updated.");
    } catch (err) {
      next(err);
    }
  };

  updateBankDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vendorCode: _ignoredVendorCode, bankAccount, ifsc, upiId } = req.body;
      const profile = await this.vendorService.updateBankDetailByVendorId(getVendorId(req), {
        bankAccount,
        ifsc,
        upiId,
      });
      sendSuccess(res, profile, "Bank details updated.");
    } catch (err) {
      next(err);
    }
  };

  updateKyc = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vendorCode: _ignoredVendorCode, aadhaarNumber, panNumber } = req.body;
      const files = req.files as { [field: string]: Express.Multer.File[] };
      const profile = await this.vendorService.updateKycByVendorId(
        getVendorId(req),
        { aadhaarNumber, panNumber },
        {
          aadhaarFront: files?.aadhaarFront?.[0]?.buffer,
          aadhaarBack: files?.aadhaarBack?.[0]?.buffer,
          pan: files?.pan?.[0]?.buffer,
        }
      );
      sendSuccess(res, profile, "KYC updated.");
    } catch (err) {
      next(err);
    }
  };

  uploadProfilePhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw createHttpError(400, "file is required.");
      const profile = await this.vendorService.uploadProfilePhotoByVendorId(
        getVendorId(req),
        req.file.buffer
      );
      sendSuccess(res, profile, "Profile photo uploaded.");
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = getVendorId(req);
      const { currentPassword, newPassword } = req.body;
      await this.vendorService.changePassword(vendorId, currentPassword, newPassword);
      sendSuccess(res, undefined, "Password changed successfully.");
    } catch (err) {
      next(err);
    }
  };

  submitForVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.vendorService.submitForVerificationByVendorId(getVendorId(req));
      sendSuccess(res, profile, "Profile submitted for admin verification.");
    } catch (err) {
      next(err);
    }
  };

  requestAccountDeletion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = getVendorId(req);
      const { reason } = req.body;
      await this.vendorService.requestAccountDeletion(vendorId, reason);
      sendSuccess(res, undefined, "Deletion request submitted. An admin will review it.");
    } catch (err) {
      next(err);
    }
  };

  wallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.vendorService.wallet(getVendorId(req)), "Wallet fetched.");
    } catch (e) {
      next(e);
    }
  };

  walletHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.vendorService.walletHistory(getVendorId(req), page(req), limit(req));
      sendSuccess(res, r.items, "Wallet history fetched.", 200, r.pagination);
    } catch (e) {
      next(e);
    }
  };

  recharge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.recharge(getVendorId(req), req.body.amount),
        "Wallet recharged."
      );
    } catch (e) {
      next(e);
    }
  };

  walletIssue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.walletIssue(
          getVendorId(req),
          req.body.subject,
          req.body.description
        ),
        "Wallet issue raised.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  createLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await this.vendorService.createLead(getVendorId(req), req.body);
      sendSuccess(res, lead, "Lead submitted to admin successfully.", 201);
    } catch (e) {
      next(e);
    }
  };

  leads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.vendorService.listLeads(getVendorId(req), page(req), limit(req));
      sendSuccess(res, r.items, "Leads fetched.", 200, r.pagination);
    } catch (e) {
      next(e);
    }
  };

  lead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.leadDetail(getVendorId(req), req.params.leadId as string),
        "Lead fetched."
      );
    } catch (e) {
      next(e);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.acceptLead(getVendorId(req), req.params.leadId as string),
        "Lead accepted."
      );
    } catch (e) {
      next(e);
    }
  };

  start = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
      const image = files?.image?.[0]?.buffer;
      sendSuccess(
        res,
        await this.vendorService.startWork(getVendorId(req), req.params.leadId as string, {
          ...req.body,
          image,
        }),
        "Start-work proof submitted."
      );
    } catch (e) {
      next(e);
    }
  };

  deny = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
      const image = files?.image?.[0]?.buffer;
      sendSuccess(
        res,
        await this.vendorService.denyLead(getVendorId(req), req.params.leadId as string, {
          ...req.body,
          image,
        }),
        "Denial proof submitted."
      );
    } catch (e) {
      next(e);
    }
  };

  complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.completeLead(getVendorId(req), req.params.leadId as string),
        "Payment QR generated."
      );
    } catch (e) {
      next(e);
    }
  };

  notifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.vendorService.notifications(getVendorId(req), page(req), limit(req));
      sendSuccess(res, r.items, "Notifications fetched.", 200, r.pagination);
    } catch (e) {
      next(e);
    }
  };

  read = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.markNotificationsRead(
          getVendorId(req),
          false,
          req.params.id as string
        ),
        "Notification marked as read."
      );
    } catch (e) {
      next(e);
    }
  };

  readAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.markNotificationsRead(getVendorId(req), true),
        "Notifications marked as read."
      );
    } catch (e) {
      next(e);
    }
  };

  offers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.vendorService.offers(getVendorId(req)), "Offers fetched.");
    } catch (e) {
      next(e);
    }
  };

  products = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.vendorService.products(), "Products fetched.");
    } catch (e) {
      next(e);
    }
  };

  parts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.vendorService.parts(), "Parts fetched.");
    } catch (e) {
      next(e);
    }
  };

  productPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.purchaseProduct(
          getVendorId(req),
          req.body.productId,
          req.body.quantity
        ),
        "Product purchased.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  partPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.purchasePart(
          getVendorId(req),
          req.body.partId,
          req.body.quantity
        ),
        "Part purchased.",
        201
      );
    } catch (e) {
      next(e);
    }
  };

  complaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.vendorService.complaints(getVendorId(req)), "Complaints fetched.");
    } catch (e) {
      next(e);
    }
  };

  complaint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await this.vendorService.createComplaint(
          getVendorId(req),
          req.body.category,
          req.body.subject,
          req.body.description
        ),
        "Complaint created.",
        201
      );
    } catch (e) {
      next(e);
    }
  };
}
