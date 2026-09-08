import { sendMail } from "./mailer";
import { ActivityLogService, ActivityMeta } from "../base/ActivityLogService";

export async function logActivity(userId: string | undefined | null, action: string, meta?: ActivityMeta) {
  await ActivityLogService.log(userId, action, meta);
}

export async function sendMailSafe(input: { to?: string | null; subject: string; html: string; text?: string }) {
  if (!input.to) return { success: false, skipped: true };
  try {
    const result = await sendMail({ to: input.to, subject: input.subject, html: input.html, text: input.text });
    if (!result.success) console.error("[service-events] Mail failed:", result.error);
    return result;
  } catch (error) {
    console.error("[service-events] Mail threw:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function simpleEmail(title: string, message: string) {
  const escaped = message.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5"><h2>${title}</h2><p>${escaped}</p><p>Regards,<br/>Just24You Team</p></body></html>`;
}
