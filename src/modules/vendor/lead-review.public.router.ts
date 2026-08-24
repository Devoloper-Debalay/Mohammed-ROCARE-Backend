import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import "../../container";
import { container } from "tsyringe";
import { VendorService } from "./vendor.service";
import { sendSuccess } from "../../shared/response";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { ReviewDto } from "./vendor.dto";

/**
 * Deliberately NOT behind requireVendorAuth/enforceVendor — the client,
 * not the vendor, submits this. Ownership is enforced inside
 * VendorService.review() via the reviewToken issued at lead completion,
 * not via a bearer token.
 */
const leadReviewRouter = Router();
const vendorService = container.resolve(VendorService);

leadReviewRouter.post(
  "/:leadId/review",
  dtoValidation(ReviewDto),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reviewToken, rating, comment } = req.body;
      const result = await vendorService.review(req.params.leadId as string, reviewToken, rating, comment);
      sendSuccess(res, result, "Review submitted.", 201);
    } catch (err) {
      next(err);
    }
  }
);

export default leadReviewRouter;
