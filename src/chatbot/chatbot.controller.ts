import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import * as chatbotService from "./chatbot.service";

// Adjust this to however your auth middleware actually attaches the user.
// Shown here as req.user.id, matching the pattern implied by your existing
// authRouter/requireAuth setup.
function getUserId(req: Request): string {
  const user = req.user as { id?: string; userId?: string; _id?: string } | undefined;
  const userId = user?.id || user?.userId || user?._id;

  if (!userId) throw createError(401, "Unauthenticated request reached chatbot controller.");
  return userId;
}

function getSessionId(req: Request): string {
  const sessionId = req.params.sessionId;
  if (!sessionId) throw createError(400, "sessionId is required.");
  return sessionId as string;
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { sessionId, message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required." });
    }

    const result = await chatbotService.sendMessage(userId, sessionId, message.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function sendMessageWithImage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { sessionId, message } = req.body;
    const file = (req as any).file; // requires multer upstream in the router

    if (!file) {
      return res.status(400).json({ error: "file is required." });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required." });
    }

    const result = await chatbotService.sendMessageWithImage(
      userId,
      sessionId,
      message.trim(),
      file.buffer,
      file.originalname,
      file.mimetype
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);
    const history = await chatbotService.getHistory(userId, sessionId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const sessions = await chatbotService.listSessions(userId);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
}

export async function deleteSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);
    const result = await chatbotService.deleteSession(userId, sessionId);

    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
}