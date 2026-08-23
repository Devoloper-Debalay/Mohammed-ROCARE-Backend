import createHttpError from "http-errors";
import prisma from "../config/database";
import { getIO } from "../sockets/socket.instance";
import { deleteChatFile } from "../utils/deleteChatFile";
import { uploadChatFile } from "../utils/uploadChatFile";


export const ChatService = {

  // ── Get or create direct chat room between two users ──────────────────────
  async getOrCreateDirectRoom(userAId: string, userBId: string) {
    if (userAId === userBId)
      throw createHttpError(400, "Cannot create a chat with yourself.");

    const existing = await prisma.chatRoom.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          { members: { some: { userId: userAId } } },
          { members: { some: { userId: userBId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: true,
                role: true,
              },
            },
          },
        },
      },
    });

    const room = existing ?? await prisma.chatRoom.create({
      data: {
        type: "DIRECT",
        members: {
          create: [
            { userId: userAId },
            { userId: userBId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // ── Resolve recipient from the perspective of userAId ──
    const recipient = room.members.find((m) => m.userId !== userAId)?.user;

    return {
      ...room,
      // ── These fields let the frontend display the room correctly ──
      displayName: recipient ? `${recipient.firstName} ${recipient.lastName}` : "Unknown",
      displayPhoto: recipient?.profilePhoto ?? null,
      recipient,
    };
  },

  // ── Get messages for a chat room ───────────────────────────────────────────
  async getRoomMessages(
    userId: string,
    chatRoomId: string,
    limit = 50,
    cursor?: string
  ) {
    const isMember = await prisma.chatRoomMember.findUnique({
      where: { UniqueChatMember: { chatRoomId, userId } },
    });
    if (!isMember)
      throw createHttpError(403, "You are not a member of this chat room.");

    const messages = await prisma.message.findMany({
      where: { chatRoomId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
        readBy: { select: { userId: true, readAt: true } },
      },
    });

    // ── Auto-mark all unread messages in this room as read ──
    await this.markMessagesRead(userId, chatRoomId);

    return messages.reverse();
  },

  // ── Send a text message ────────────────────────────────────────────────────
  async sendTextMessage(
    senderId: string,
    chatRoomId: string,
    content: string
  ) {
    const isMember = await prisma.chatRoomMember.findUnique({
      where: { UniqueChatMember: { chatRoomId, userId: senderId } },
    });
    if (!isMember)
      throw createHttpError(403, "You are not a member of this chat room.");

    const message = await prisma.message.create({
      data: { chatRoomId, senderId, type: "TEXT", content },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
    });

    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    return message;
  },

  // ── Send a file message (image, document, voice) ───────────────────────────
  async sendFileMessage(
    senderId: string,
    chatRoomId: string,
    file: Express.Multer.File,
    duration?: number // for voice messages
  ) {
    const isMember = await prisma.chatRoomMember.findUnique({
      where: { UniqueChatMember: { chatRoomId, userId: senderId } },
    });
    if (!isMember)
      throw createHttpError(403, "You are not a member of this chat room.");

    // ── Determine message type from mime ──
    let type: "IMAGE" | "DOCUMENT" | "VOICE" = "DOCUMENT";
    let uploadType: "image" | "document" | "voice" = "document";

    if (file.mimetype.startsWith("image/")) {
      type = "IMAGE";
      uploadType = "image";
    } else if (file.mimetype.startsWith("audio/")) {
      type = "VOICE";
      uploadType = "voice";
    }

    const fileUrl = await uploadChatFile(
      file.buffer,
      senderId,
      uploadType,
      file.originalname
    );

    const message = await prisma.message.create({
      data: {
        chatRoomId,
        senderId,
        type,
        fileUrl,
        fileName: file.originalname,
        fileMimeType: file.mimetype,
        duration: duration ?? null,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
    });

    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    return message;
  },

  // ── Edit a message ─────────────────────────────────────────────────────────
  async editMessage(userId: string, messageId: string, content: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) throw createHttpError(404, "Message not found.");
    if (message.isDeleted) throw createHttpError(410, "Cannot edit a deleted message.");
    if (message.senderId !== userId)
      throw createHttpError(403, "You can only edit your own messages.");
    if (message.type !== "TEXT")
      throw createHttpError(400, "Only text messages can be edited.");
    if (!content || !content.trim())
      throw createHttpError(400, "Message content cannot be empty.");
    if (content === message.content)
      throw createHttpError(400, "New content must be different from the current message.");

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profilePhoto: true },
        },
      },
    });

    // ── Notify everyone else in the room in real time ──
    getIO().to(message.chatRoomId).emit("message_edited", updated);

    return updated;
  },

  // ── Delete a message ───────────────────────────────────────────────────────
  async deleteMessage(userId: string, messageId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) throw createHttpError(404, "Message not found.");
    if (message.isDeleted) throw createHttpError(410, "This message has already been deleted.");
    if (message.senderId !== userId)
      throw createHttpError(403, "You can only delete your own messages.");

    // ── If this message had an attached file, remove it from Cloudinary too ──
    if (message.fileUrl && message.type !== "TEXT") {
      const cloudinaryType =
        message.type === "IMAGE" ? "image" :
          message.type === "VOICE" ? "voice" :
            "document";

      await deleteChatFile(message.fileUrl, cloudinaryType);
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: null, fileUrl: null },
    });

    // ── Notify everyone else in the room in real time ──
    getIO().to(message.chatRoomId).emit("message_deleted", {
      messageId: updated.id,
      chatRoomId: message.chatRoomId,
    });

    return updated;
  },

  // ── Mark messages as read (specific ids, or all unread if none given) ──────
  async markMessagesRead(userId: string, chatRoomId: string, messageIds?: string[]) {
    const member = await prisma.chatRoomMember.findUnique({
      where: { UniqueChatMember: { chatRoomId, userId } },
    });
    if (!member) throw createHttpError(403, "You are not a member of this chat room.");

    let idsToMark = messageIds;

    // ── If no specific ids given, resolve every unread message in this room ──
    if (!idsToMark || idsToMark.length === 0) {
      const unreadMessages = await prisma.message.findMany({
        where: {
          chatRoomId,
          isDeleted: false,
          senderId: { not: userId }, // don't need to "read" your own messages
          createdAt: { gt: member.lastReadAt ?? new Date(0) },
        },
        select: { id: true },
      });
      idsToMark = unreadMessages.map((m) => m.id);
    }

    if (idsToMark.length > 0) {
      await prisma.messageRead.createMany({
        data: idsToMark.map((messageId) => ({ messageId, userId })),
        skipDuplicates: true,
      });
    }

    await prisma.chatRoomMember.update({
      where: { UniqueChatMember: { chatRoomId, userId } },
      data: { lastReadAt: new Date() },
    });

    return { marked: idsToMark.length };
  },

  // ── Get unread count ───────────────────────────────────────────────────────
  async getUnreadCount(userId: string, chatRoomId: string) {
    const member = await prisma.chatRoomMember.findUnique({
      where: { UniqueChatMember: { chatRoomId, userId } },
    });

    if (!member) throw createHttpError(403, "Not a member of this room.");

    const count = await prisma.message.count({
      where: {
        chatRoomId,
        isDeleted: false,
        createdAt: { gt: member.lastReadAt ?? new Date(0) },
        senderId: { not: userId },
      },
    });

    return { unreadCount: count };
  },
};