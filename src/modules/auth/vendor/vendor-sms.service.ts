import axios from "axios";
import createHttpError from "http-errors";

export interface VendorSmsService {
  sendOtp(phone: string, code: string, purpose: string): Promise<void>;
}

class SmsService implements VendorSmsService {
  async sendOtp(phone: string, code: string, purpose: string): Promise<void> {
    const provider = (process.env.VENDOR_SMS_PROVIDER || process.env.SMS_PROVIDER || "console").toLowerCase();

    if (provider === "console") {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[vendor-auth] OTP for ${phone} (${purpose}): ${code}`);
        return;
      }
      throw createHttpError(500, "SMS provider is not configured for production.");
    }

    if (provider !== "twilio") {
      throw createHttpError(500, `Unsupported vendor SMS provider: ${provider}`);
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const from = process.env.TWILIO_FROM_PHONE;

    if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
      throw createHttpError(500, "Twilio SMS configuration is incomplete.");
    }

    const body = new URLSearchParams({
      To: phone,
      Body: `Your vendor verification code is ${code}. It expires in 5 minutes.`,
    });

    if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
    else body.set("From", from!);

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      body.toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10_000,
      }
    );
  }
}

export const vendorSmsService: VendorSmsService = new SmsService();
