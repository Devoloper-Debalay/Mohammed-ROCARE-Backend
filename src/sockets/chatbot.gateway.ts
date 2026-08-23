import { Server, Socket } from "socket.io";
import prisma from "../config/database";
import { chatbotSessionHelpers } from "../chatbot/chatbot.service";
import { askChatbotStream } from "../chatbot/chatbot.client";


interface ChatbotMessagePayload {
  userId: string;
  sessionId?: string;
  message: string;
}

/** Registered alongside your existing registerChatGateway in index.ts.
 * Separate event names ("chatbot:*") so it never collides with your
 * existing human-to-human chat events. */
export function registerChatbotGateway(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("chatbot:message", async (payload: ChatbotMessagePayload) => {
      const { userId, sessionId, message } = payload;

      if (!userId || !message?.trim()) {
        socket.emit("chatbot:error", { error: "userId and message are required." });
        return;
      }

      try {
        const session = await chatbotSessionHelpers.getOrCreateSession(userId, sessionId);
        const history = await chatbotSessionHelpers.loadHistory(session.id);

        await prisma.chatbotMessage.create({
          data: { sessionId: session.id, role: "user", content: message },
        });

        const response = await askChatbotStream(message, history);

        let fullReply = "";
        response.data.on("data", (chunk: Buffer) => {
          const token = chunk.toString();
          fullReply += token;
          socket.emit("chatbot:token", { sessionId: session.id, token });
        });

        response.data.on("end", async () => {
          await prisma.chatbotMessage.create({
            data: { sessionId: session.id, role: "bot", content: fullReply },
          });
          socket.emit("chatbot:done", { sessionId: session.id });
        });

        response.data.on("error", (err: Error) => {
          console.error("Chatbot stream error:", err);
          socket.emit("chatbot:error", { error: "Streaming failed midway." });
        });
      } catch (err) {
        console.error("Chatbot gateway error:", err);
        socket.emit("chatbot:error", {
          error: err instanceof Error ? err.message : "Chatbot service unavailable.",
        });
      }
    });
  });
}
