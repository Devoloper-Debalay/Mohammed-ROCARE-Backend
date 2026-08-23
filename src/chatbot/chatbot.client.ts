import axios from "axios";
import FormData from "form-data";
import { ChatbotTurn } from "./chatbot.types";

const CHATBOT_URL = process.env.CHATBOT_URL || "http://localhost:8001";
const INTERNAL_SECRET = process.env.CHATBOT_INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  // Fail loudly at startup rather than silently sending unauthenticated
  // requests that the Python side will reject one by one.
  console.warn(
    "⚠️  CHATBOT_INTERNAL_SECRET is not set. Requests to the chatbot service will be unauthenticated."
  );
}

const httpClient = axios.create({
  baseURL: CHATBOT_URL,
  timeout: 20_000,
  headers: INTERNAL_SECRET ? { "x-internal-secret": INTERNAL_SECRET } : {},
});

export async function askChatbot(query: string, history: ChatbotTurn[]): Promise<string> {
  try {
    const { data } = await httpClient.post<{ response: string }>("/api/chat", {
      query,
      history,
    });
    return data.response;
  } catch (err) {
    throw normalizeChatbotError(err);
  }
}

export async function askChatbotWithImage(
  query: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append("query", query);
  form.append("file", fileBuffer, { filename, contentType: mimeType });

  try {
    const headers: Record<string, string> = { ...form.getHeaders() };
    if (INTERNAL_SECRET) headers["x-internal-secret"] = INTERNAL_SECRET;

    const { data } = await httpClient.post<{ response: string }>("/api/chat/image", form, {
      headers,
      timeout: 30_000,
    });
    return data.response;
  } catch (err) {
    throw normalizeChatbotError(err);
  }
}

/** Streaming variant — returns the raw axios stream response for the
 * socket gateway to pipe token-by-token to the client. */
export async function askChatbotStream(query: string, history: ChatbotTurn[]) {
  return httpClient.post(
    "/api/chat/stream",
    { query, history },
    { responseType: "stream" }
  );
}

function normalizeChatbotError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      // FastAPI's HTTPException shape: { detail: "..." }
      const detail = (err.response.data as any)?.detail;
      return new Error(
        `Chatbot service error (${err.response.status}): ${detail || err.message}`
      );
    }
    if (err.request) {
      return new Error("Chatbot service did not respond (timeout or unreachable).");
    }
  }
  return err instanceof Error ? err : new Error("Unknown chatbot service error.");
}
