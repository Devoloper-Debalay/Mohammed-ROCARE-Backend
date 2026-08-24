import { Router } from "express";
import multer from "multer";
import "../../container"; // ensure the DI container is initialized before resolving
import { container } from "tsyringe";
import { VendorController } from "./vendor.controller";
import { requireVendorAuth } from "../auth/vendor/vendor-auth.middleware";
import { enforceVendor } from "../../middlewares/enforceVendor";
import { dtoValidation } from "../../middlewares/dtoValidation";
import {
  UpdateVendorProfileDto,
  UpdateVendorBankDto,
  UpdateVendorKycDto,
  RequestAccountDeletionDto,
  ChangeVendorPasswordDto,
  LeadActionDto,
  PurchasePartDto,
  PurchaseProductDto,
  RechargeWalletDto,
  ReviewDto,
  ComplaintDto,
} from "./vendor.dto";
import { VendorRole } from "../../generated/prisma/enums";

const vendorRouter = Router();
const controller = container.resolve(VendorController);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

// Every route below requires a valid vendor access token and a
// non-blocked/non-deleted account. No specific role restriction here —
// both AGENT and TECHNICIAN manage their own profile the same way.

vendorRouter.get("/profile",requireVendorAuth, controller.getProfile);
vendorRouter.patch("/profile", dtoValidation(UpdateVendorProfileDto), controller.updateProfile);
vendorRouter.post(
  "/profile/photo",
  upload.single("file"),
  controller.uploadProfilePhoto
);

vendorRouter.put("/bank-details", dtoValidation(UpdateVendorBankDto), controller.updateBankDetail);

vendorRouter.put(
  "/kyc",
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "pan", maxCount: 1 },
  ]),
  dtoValidation(UpdateVendorKycDto),
  controller.updateKyc
);

vendorRouter.post("/submit-for-verification", controller.submitForVerification);

vendorRouter.post("/change-password",requireVendorAuth, enforceVendor(), dtoValidation(ChangeVendorPasswordDto), controller.changePassword);

vendorRouter.post(
  "/account/delete-request",
  requireVendorAuth,
  enforceVendor(),
  dtoValidation(RequestAccountDeletionDto),
  controller.requestAccountDeletion
);

vendorRouter.get("/wallet", requireVendorAuth, enforceVendor(), controller.wallet);
vendorRouter.get("/wallet/history", requireVendorAuth, enforceVendor(), controller.walletHistory);
vendorRouter.post("/wallet/recharge", requireVendorAuth, enforceVendor(), dtoValidation(RechargeWalletDto), controller.recharge);
vendorRouter.post("/wallet/raise-issue", requireVendorAuth, enforceVendor(), dtoValidation(ComplaintDto), controller.walletIssue);

vendorRouter.get("/leads",requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), controller.leads);
vendorRouter.get("/leads/:leadId", requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), controller.lead);
vendorRouter.post("/leads/:leadId/accept", requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), controller.accept);
vendorRouter.post("/leads/:leadId/start", requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), upload.fields([{ name: "image", maxCount: 1 }]), dtoValidation(LeadActionDto), controller.start);
vendorRouter.post("/leads/:leadId/deny", requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), upload.fields([{ name: "image", maxCount: 1 }]), dtoValidation(LeadActionDto), controller.deny);
vendorRouter.post("/leads/:leadId/complete", requireVendorAuth, enforceVendor(VendorRole.TECHNICIAN), controller.complete);
// NOTE: lead review moved to a public router (lead-review.public.router.ts) —
// it must NOT require vendor auth, since the client (not the vendor) submits it.

vendorRouter.get("/notifications",requireVendorAuth, enforceVendor(), controller.notifications);
vendorRouter.patch("/notifications/:id/read", requireVendorAuth, enforceVendor(), controller.read);
vendorRouter.patch("/notifications/read-all", requireVendorAuth, enforceVendor(), controller.readAll);
vendorRouter.get("/offers", requireVendorAuth, enforceVendor(), controller.offers);
vendorRouter.get("/products", requireVendorAuth, enforceVendor(), controller.products);
vendorRouter.post("/products/purchase", requireVendorAuth, enforceVendor(), dtoValidation(PurchaseProductDto), controller.productPurchase);
vendorRouter.get("/parts", requireVendorAuth, enforceVendor(), controller.parts);
vendorRouter.post("/parts/purchase", requireVendorAuth, enforceVendor(), dtoValidation(PurchasePartDto), controller.partPurchase);
vendorRouter.get("/complaints", requireVendorAuth, enforceVendor(), controller.complaints);
vendorRouter.post("/complaints", requireVendorAuth, enforceVendor(), dtoValidation(ComplaintDto), controller.complaint);

export default vendorRouter;
