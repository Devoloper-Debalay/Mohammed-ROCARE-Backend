import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import {
  sendMessage,
  sendMessageWithImage,
  getHistory,
  listSessions,
  deleteSession,
} from "./chatbot.controller";
import { SendMessageDto, SendMessageWithImageDto } from "./chatbot.dto";
import { dtoValidation } from "../middlewares/dtoValidation";
import { verifyToken } from "../middlewares/jwtVerifiction";

const chatbotRouter = Router();

// Stricter than your global limiter (100/min in app.ts) — LLM calls cost
// real money per request, worth throttling harder specifically here.
const chatbotLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: "Too many chatbot requests — please slow down." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB, matches the Python side's limit
});

chatbotRouter.use(verifyToken, chatbotLimiter);

chatbotRouter.post("/message", dtoValidation(SendMessageDto),sendMessage);
chatbotRouter.post("/message/image", upload.single("file"), dtoValidation(SendMessageWithImageDto),sendMessageWithImage);
chatbotRouter.get("/sessions", listSessions);
chatbotRouter.get("/:sessionId/history", getHistory);
chatbotRouter.delete("/:sessionId", deleteSession);

export default chatbotRouter;
