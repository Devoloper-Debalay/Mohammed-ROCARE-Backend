export interface ChatbotTurn {
  role: "user" | "bot";
  content: string;
}

export interface SendMessageResult {
  sessionId: string;
  reply: string;
}
