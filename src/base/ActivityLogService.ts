import prisma from "../config/database";

export const ActivityLogService = {
  async log(userId: string, action: string, meta?: string) {
    try {
      await prisma.activityLog.create({
        data: { userId, action, meta },
      });
    } catch (err) {
      console.error("Failed to write activity log:", err);
    }
  }
};

