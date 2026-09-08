import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
// touch: force ts-node-dev to respawn and pick up fresh .env values

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;