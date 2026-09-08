import cloudinary from "../config/cloudinary";
import { Readable } from "stream";

/**
 * Upload a single image buffer to Cloudinary in the specified folder
 */
export async function uploadProductImage(
  fileBuffer: Buffer,
  folder = "just24you/products"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary image upload failed"));
        }
        resolve(result.secure_url);
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
}

/**
 * Upload a spare part image buffer to Cloudinary under just24you/parts
 */
export async function uploadPartImage(
  fileBuffer: Buffer,
  folder = "just24you/parts"
): Promise<string> {
  return uploadProductImage(fileBuffer, folder);
}

/**
 * Upload multiple image buffers sequentially or in parallel to Cloudinary
 */
export async function uploadMultipleImages(
  fileBuffers: Buffer[],
  folder = "just24you/products"
): Promise<string[]> {
  if (!fileBuffers || fileBuffers.length === 0) return [];
  return Promise.all(fileBuffers.map((buf) => uploadProductImage(buf, folder)));
}
