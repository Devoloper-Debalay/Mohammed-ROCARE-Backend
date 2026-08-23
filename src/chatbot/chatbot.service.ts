import prisma from "../config/database";
import { askChatbot, askChatbotWithImage } from "./chatbot.client";
import { ChatbotTurn, SendMessageResult } from "./chatbot.types";

const HISTORY_WINDOW = 20; // bounded — don't send unlimited history to Gemini

async function getOrCreateSession(userId: string, sessionId?: string) {
  if (sessionId) {
    const existing = await prisma.chatbotSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (existing) return existing;
  }
  return prisma.chatbotSession.create({ data: { userId } });
}

async function loadHistory(sessionId: string): Promise<ChatbotTurn[]> {
  const rows = await prisma.chatbotMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_WINDOW,
  });
  return rows.map((r: { role: string; content: string }) => ({
    role: r.role as "user" | "bot",
    content: r.content,
  }));
}

export async function sendMessage(
  userId: string,
  sessionId: string | undefined,
  message: string
): Promise<SendMessageResult> {
  const session = await getOrCreateSession(userId, sessionId);
  const history = await loadHistory(session.id);

  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  const reply = await askChatbot(message, history);

  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "bot", content: reply },
  });

  // Auto-title new sessions from the first message, so a session list
  // in the UI isn't just a wall of timestamps.
  if (!session.title) {
    await prisma.chatbotSession.update({
      where: { id: session.id },
      data: { title: message.slice(0, 60) },
    });
  }

  return { sessionId: session.id, reply };
}

export async function sendMessageWithImage(
  userId: string,
  sessionId: string | undefined,
  message: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<SendMessageResult> {
  const session = await getOrCreateSession(userId, sessionId);

  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "user", content: `${message} [image attached]` },
  });

  const reply = await askChatbotWithImage(message, fileBuffer, filename, mimeType);

  await prisma.chatbotMessage.create({
    data: { sessionId: session.id, role: "bot", content: reply },
  });

  return { sessionId: session.id, reply };
}

export async function getHistory(userId: string, sessionId: string) {
  return prisma.chatbotMessage.findMany({
    where: { sessionId, session: { userId } },
    orderBy: { createdAt: "asc" },
  });
}

export async function listSessions(userId: string) {
  return prisma.chatbotSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  const session = await prisma.chatbotSession.findFirst({ where: { id: sessionId, userId } });

  if (!session) {
    return { success: false, message: "Session not found." };
  }

  await prisma.chatbotSession.delete({ where: { id: sessionId } });
  return { success: true, message: "Session deleted successfully." };
}

/** Used by the streaming socket gateway, which needs history loaded and
 * messages persisted but does not go through the request/response call
 * in askChatbot — it pipes tokens directly instead. */
export const chatbotSessionHelpers = { getOrCreateSession, loadHistory };
