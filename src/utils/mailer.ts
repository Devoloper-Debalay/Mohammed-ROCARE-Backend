import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";

const SMTP_PORT = Number(
  process.env.SMTP_PORT || 465
);

const SMTP_SECURE =
  process.env.SMTP_SECURE === "true";

const SMTP_USER = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

const SMTP_PASS = process.env.SMTP_PASS;

const FROM_EMAIL =
  process.env.SMTP_FROM_EMAIL ||
  SMTP_USER ||
  "noreply.just24you@gmail.com";

const FROM_NAME =
  process.env.SMTP_FROM_NAME ||
  "Just24You";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

if (!SMTP_USER || !SMTP_PASS) {
  console.warn(
    "[mailer] Gmail SMTP is not fully configured. " +
      "SMTP_USER and SMTP_PASS are required."
  );
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,

  port: SMTP_PORT,

  secure: SMTP_SECURE,

  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Optional SMTP connection verification.
 *
 * Call this during application startup if needed.
 */
export async function verifyMailer(): Promise<boolean> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[mailer] SMTP verification skipped: configuration missing."
    );

    return false;
  }

  try {
    await transporter.verify();

    console.log(
      "[mailer] Gmail SMTP connection verified successfully."
    );

    return true;
  } catch (error: any) {
    console.error(
      "[mailer] Gmail SMTP verification failed:",
      {
        message: error?.message,
        code: error?.code,
        command: error?.command,
      }
    );

    return false;
  }
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: SendMailInput): Promise<{
  success: boolean;
  error?: string;
}> {
  /**
   * Development mode.
   *
   * Prevents actual email sending.
   */
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MAILER_DEV_MODE === "true"
  ) {
    console.log(
      `[mailer:dev]
To: ${to}
Subject: ${subject}

${text ?? html.replace(/<[^>]+>/g, "")}`
    );

    return {
      success: true,
    };
  }

  if (!SMTP_USER || !SMTP_PASS) {
    const error =
      "SMTP_USER or SMTP_PASS is not configured.";

    console.error(`[mailer] ${error}`);

    return {
      success: false,
      error,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: {
        name: FROM_NAME,
        address: FROM_EMAIL,
      },

      to,

      subject,

      html,

      text:
        text ??
        html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
    });

    console.log(
      `[mailer] Email sent successfully | ` +
        `To: ${to} | ` +
        `MessageId: ${info.messageId}`
    );

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response ||
      error?.message ||
      "Unknown email sending error";

    console.error(
      "[mailer] Nodemailer send failed:",
      {
        message: errorMessage,
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      }
    );

    return {
      success: false,
      error: String(errorMessage),
    };
  }
}