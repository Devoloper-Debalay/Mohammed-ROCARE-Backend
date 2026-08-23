import { v2 as cloudinary } from "cloudinary";

type ChatFileType = "image" | "document" | "voice";

// ── Extract Cloudinary public_id from a stored secure_url ──────────────────
function extractPublicId(fileUrl: string, resourceType: "image" | "raw"): string {
  // Example: .../upload/v1783487376/neuroviz/chat/documents/document_xxx_123.docx
  const afterUpload = fileUrl.split("/upload/")[1]; // "v1783487376/neuroviz/chat/documents/document_xxx_123.docx"
  const withoutVersion = afterUpload.replace(/^v\d+\//, ""); // "neuroviz/chat/documents/document_xxx_123.docx"

  if (resourceType === "raw") {
    return withoutVersion; // raw keeps the extension as part of public_id
  }

  // image/video: strip the extension
  return withoutVersion.replace(/\.[^/.]+$/, "");
}

export async function deleteChatFile(fileUrl: string, type: ChatFileType) {
  try {
    const resourceType: "image" | "raw" = type === "image" ? "image" : "raw";
    const publicId = extractPublicId(fileUrl, resourceType);

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // ── Don't let a Cloudinary failure block message deletion ──
    console.error("⚠️ Failed to delete file from Cloudinary:", err);
  }
}