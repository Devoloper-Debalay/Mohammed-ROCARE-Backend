import cloudinary from "../config/cloudinary";
import { Readable } from "stream";

export type VendorDocumentType =
  | "aadhaar-front"
  | "aadhaar-back"
  | "pan"
  | "profile-photo"
  | "lead-start"
  | "lead-denial";

export async function uploadVendorDocument(
  fileBuffer: Buffer,
  vendorId: string,
  docType: VendorDocumentType,
  identifier?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const publicId = identifier
      ? `vendor_${vendorId}_${docType}_${identifier}`
      : `vendor_${vendorId}_${docType}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "just24you/vendor-documents",
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }

        resolve(result.secure_url);
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
}