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
  ComplaintDto,
  VendorCreateLeadDto,
} from "./vendor.dto";
import { VendorRole } from "../../generated/prisma/enums";

const vendorRouter = Router();
const controller = container.resolve(VendorController);

// All vendor business routes require authenticated vendor identity.
vendorRouter.use(requireVendorAuth, enforceVendor());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

vendorRouter.get("/profile", controller.getProfile);
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
vendorRouter.post("/change-password", dtoValidation(ChangeVendorPasswordDto), controller.changePassword);

vendorRouter.post(
  "/account/delete-request",
  requireVendorAuth,
  enforceVendor(),
  dtoValidation(RequestAccountDeletionDto),
  controller.requestAccountDeletion
);

vendorRouter.get("/wallet", controller.wallet);
vendorRouter.get("/wallet/history", controller.walletHistory);
vendorRouter.post("/wallet/recharge", dtoValidation(RechargeWalletDto), controller.recharge);
vendorRouter.post("/wallet/raise-issue", dtoValidation(ComplaintDto), controller.walletIssue);

// Vendor Leads (Technicians)
vendorRouter.post("/leads", dtoValidation(VendorCreateLeadDto), controller.createLead);
vendorRouter.get("/leads", enforceVendor(VendorRole.TECHNICIAN), controller.leads);
vendorRouter.get("/leads/:leadId", enforceVendor(VendorRole.TECHNICIAN), controller.lead);
vendorRouter.post("/leads/:leadId/accept", enforceVendor(VendorRole.TECHNICIAN), controller.accept);
vendorRouter.post("/leads/:leadId/start", enforceVendor(VendorRole.TECHNICIAN), upload.fields([{ name: "image", maxCount: 1 }]), dtoValidation(LeadActionDto), controller.start);
vendorRouter.post("/leads/:leadId/deny", enforceVendor(VendorRole.TECHNICIAN), upload.fields([{ name: "image", maxCount: 1 }]), dtoValidation(LeadActionDto), controller.deny);
vendorRouter.post("/leads/:leadId/complete", enforceVendor(VendorRole.TECHNICIAN), controller.complete);

vendorRouter.get("/notifications", controller.notifications);
vendorRouter.patch("/notifications/:id/read", controller.read);
vendorRouter.patch("/notifications/read-all", controller.readAll);
vendorRouter.get("/offers", controller.offers);
vendorRouter.get("/products", controller.products);
vendorRouter.post("/products/purchase", dtoValidation(PurchaseProductDto), controller.productPurchase);
vendorRouter.get("/parts", controller.parts);
vendorRouter.post("/parts/purchase", dtoValidation(PurchasePartDto), controller.partPurchase);
vendorRouter.get("/complaints", controller.complaints);
vendorRouter.post("/complaints", dtoValidation(ComplaintDto), controller.complaint);

export default vendorRouter;
