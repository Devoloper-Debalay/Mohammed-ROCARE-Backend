import axios from "axios";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const BREVO_API_KEY = process.env.BREVO_API_KEY;

const FROM_EMAIL =
  process.env.BREVO_FROM_EMAIL ||
  process.env.MAIL_FROM ||
  "no-reply@rocare.com";

const FROM_NAME =
  process.env.BREVO_FROM_NAME ||
  process.env.MAIL_FROM_NAME ||
  "ROCARE";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Warn during startup, but don't crash the application.
if (!BREVO_API_KEY) {
  console.warn(
    "[mailer] BREVO_API_KEY is not set. Email sending will fail until it is configured."
  );
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
  // Development fallback.
  // Set MAILER_DEV_MODE=true to prevent real emails from being sent locally.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MAILER_DEV_MODE === "true"
  ) {
    console.log(
      `[mailer:dev] To: ${to} | Subject: ${subject}\n${
        text ?? html.replace(/<[^>]+>/g, "")
      }`
    );

    return {
      success: true,
    };
  }

  if (!BREVO_API_KEY) {
    console.error("[mailer] BREVO_API_KEY is not configured.");

    return {
      success: false,
      error: "BREVO_API_KEY is not configured",
    };
  }

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL,
        },
        to: [
          {
            email: to,
          },
        ],
        subject,
        htmlContent: html,
        textContent:
          text ?? html.replace(/<[^>]+>/g, ""),
      },
      {
        headers: {
          accept: "application/json",
          "api-key": BREVO_API_KEY,
          "content-type": "application/json",
        },
        timeout: 15_000,
      }
    );

    const messageId =
      response.data?.messageId ?? "unknown";

    console.log(
      `[mailer] Email accepted by Brevo | To: ${to} | MessageId: ${messageId}`
    );

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.code ||
      error?.message ||
      "Unknown email sending error";

    console.error("[mailer] Brevo send failed:", {
      message: errorMessage,
      status: error?.response?.status,
      data: error?.response?.data,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}