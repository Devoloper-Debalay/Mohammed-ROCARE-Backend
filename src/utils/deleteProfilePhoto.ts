import cloudinary from "../config/cloudinary";

export async function deleteProfilePhoto(userId: string): Promise<void> {
  try {
    const publicId = `neuroviz/profile-photos/user_${userId}`;
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    // ── Don't let a Cloudinary failure block the DB update ──
    console.error("⚠️ Failed to delete profile photo from Cloudinary:", err);
  }
}