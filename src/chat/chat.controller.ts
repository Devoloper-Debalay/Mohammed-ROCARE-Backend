import { Request, Response, NextFunction } from "express";
import { ChatService } from "./chat.service";

const getUserId = (res: Response): string => res.locals.userId;

export const ChatController = {

  /** POST /chat/direct/:targetUserId */
  getOrCreateDirectRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ChatService.getOrCreateDirectRoom(
        getUserId(res),
        req.params.targetUserId as string
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** GET /chat/room/:chatRoomId/messages */
  getRoomMessages: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = req.query.limit  ? Number(req.query.limit) : 50;
      const cursor = req.query.cursor as string | undefined;
      const data   = await ChatService.getRoomMessages(
        getUserId(res),
        req.params.chatRoomId as string,
        limit,
        cursor
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** POST /chat/room/:chatRoomId/message */
  sendTextMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      if (!content) throw { status: 400, message: "Message content is required." };

      const data = await ChatService.sendTextMessage(
        getUserId(res),
        req.params.chatRoomId as string,
        content
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** POST /chat/room/:chatRoomId/file */
  sendFileMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw { status: 400, message: "No file provided." };

      const duration = req.body.duration ? Number(req.body.duration) : undefined;
      const data     = await ChatService.sendFileMessage(
        getUserId(res),
        req.params.chatRoomId as string,
        req.file,
        duration
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** PATCH /chat/message/:messageId */
  editMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      const data = await ChatService.editMessage(getUserId(res), req.params.messageId as string, content);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** DELETE /chat/message/:messageId */
  deleteMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ChatService.deleteMessage(getUserId(res), req.params.messageId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** POST /chat/room/:chatRoomId/read */
  markMessagesRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageIds } = req.body;
      const data = await ChatService.markMessagesRead(
        getUserId(res),
        req.params.chatRoomId as string,
        messageIds
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  /** GET /chat/room/:chatRoomId/unread */
  getUnreadCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ChatService.getUnreadCount(getUserId(res), req.params.chatRoomId as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};