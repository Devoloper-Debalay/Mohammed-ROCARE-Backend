import { Server, Socket } from "socket.io";
import prisma from "../config/database";
import { ChatService } from "../chat/chat.service";

export function registerChatGateway(io: Server) {

  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId as string;

    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`🟢 User connected: ${userId}`);

    // ── Join all user's chat rooms on connect ──
    socket.on("join_rooms", async () => {
      const rooms = await prisma.chatRoomMember.findMany({
        where:  { userId },
        select: { chatRoomId: true },
      });
      rooms.forEach((r) => socket.join(r.chatRoomId));
      socket.emit("rooms_joined", rooms.map((r) => r.chatRoomId));
    });

    // ── Join a specific room ──
    socket.on("join_room", (chatRoomId: string) => {
      socket.join(chatRoomId);
      socket.emit("room_joined", chatRoomId);
    });

    // ── Send text message via socket ──
    socket.on("send_message", async ({ chatRoomId, content }) => {
      try {
        const message = await ChatService.sendTextMessage(userId, chatRoomId, content);

        // ── Broadcast to everyone in the room ──
        io.to(chatRoomId).emit("new_message", message);
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── Typing indicator ──
    socket.on("typing", ({ chatRoomId }) => {
      socket.to(chatRoomId).emit("user_typing", { userId, chatRoomId });
    });

    socket.on("stop_typing", ({ chatRoomId }) => {
      socket.to(chatRoomId).emit("user_stop_typing", { userId, chatRoomId });
    });

    // ── Mark messages read ──
    socket.on("mark_read", async ({ chatRoomId, messageIds }) => {
      try {
        await ChatService.markMessagesRead(userId, chatRoomId, messageIds);
        socket.to(chatRoomId).emit("messages_read", { userId, messageIds });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── Delete message ──
    socket.on("delete_message", async ({ messageId, chatRoomId }) => {
      try {
        await ChatService.deleteMessage(userId, messageId);
        io.to(chatRoomId).emit("message_deleted", { messageId });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // ── Edit message ──
    socket.on("edit_message", async ({ messageId, content, chatRoomId }) => {
      try {
        const updated = await ChatService.editMessage(userId, messageId, content);
        io.to(chatRoomId).emit("message_edited", updated);
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔴 User disconnected: ${userId}`);
    });
  });
}