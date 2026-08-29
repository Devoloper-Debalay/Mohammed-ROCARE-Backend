import prisma from "../config/database";

export type ActivityMeta = Record<string, unknown> | string | undefined;

function serializeMeta(meta?: ActivityMeta): string | undefined {
  if (meta === undefined) return undefined;
  if (typeof meta === "string") return meta;
  try { return JSON.stringify(meta); } catch { return String(meta); }
}

/**
 * Best-effort audit logging. Never let audit failures break business flows.
 * The current schema stores a User/Admin id in userId, so callers should only
 * pass ids belonging to the User table until the schema is extended with a
 * generic actorId/actorType audit model.
 */
export const ActivityLogService = {
  async log(userId: string | undefined | null, action: string, meta?: ActivityMeta) {
    if (!userId) return;
    try {
      await prisma.activityLog.create({
        data: { userId, action, meta: serializeMeta(meta) },
      });
    } catch (err) {
      console.error("[activity-log] Failed to write activity log:", err);
    }
  },
};
