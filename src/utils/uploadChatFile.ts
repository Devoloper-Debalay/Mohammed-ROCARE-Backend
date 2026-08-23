// src/utils/uploadChatFile.ts
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import path from "path";

type ChatFileType = "image" | "document" | "voice";

export async function uploadChatFile(
  fileBuffer: Buffer,
  senderId: string,
  type: ChatFileType,
  fileName: string
): Promise<string> {
  const extension = path.extname(fileName); // e.g. ".docx"

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `neuroviz/chat/${type}s`,
        public_id: `${type}_${senderId}_${Date.now()}${extension}`, // ← extension appended
        resource_type: type === "image" ? "image" : "raw",
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      }
    );
    Readable.from(fileBuffer).pipe(uploadStream);
  });
}