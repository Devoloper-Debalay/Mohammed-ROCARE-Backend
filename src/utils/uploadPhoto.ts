import cloudinary from "../config/cloudinary";
import { Readable } from "stream";

export async function uploadProfilePhoto(
  fileBuffer: Buffer,
  userId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "neuroviz/profile-photos",
        public_id: `user_${userId}`,  // overwrites old photo automatically
        overwrite: true,
        transformation: [
          { width: 300, height: 300, crop: "fill", gravity: "face" },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
}