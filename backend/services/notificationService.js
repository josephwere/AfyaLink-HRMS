import Twilio from "twilio";
import fetch from "node-fetch";

const TW_SID = process.env.TWILIO_ACCOUNT_SID;
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TW_NUMBER = process.env.TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER;

const AT_KEY = process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY;
const AT_USER = process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME;

/**
 * ✅ SAFE Twilio initialization
 * Prevents crash if SID is missing or invalid
 */
let twClient = null;

if (TW_SID && TW_SID.startsWith("AC") && TW_TOKEN) {
  twClient = new Twilio(TW_SID, TW_TOKEN);
} else {
  console.warn("⚠️ Twilio not configured — notifications will fallback to logs");
}

/**
 * Send SMS
 */
export async function sendSMS({ provider = "auto", to, message }) {
  const resolvedProvider =
    provider === "auto"
      ? twClient
        ? "twilio"
        : AT_KEY && AT_USER
          ? "africastalking"
          : "log"
      : provider;

  if (resolvedProvider === "twilio" && twClient) {
    const msg = await twClient.messages.create({
      body: message,
      from: TW_NUMBER,
      to,
    });
    return { provider: "twilio", sid: msg.sid };
  }

  if (resolvedProvider === "africastalking" && AT_KEY && AT_USER) {
    const res = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: AT_KEY,
        },
        body: new URLSearchParams({
          username: AT_USER,
          to,
          message,
        }),
      }
    );
    const raw = await res.text();
    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Africa's Talking may return XML/text depending on account tier or proxy path.
    }

    if (!res.ok) {
      const detail =
        typeof parsed === "string"
          ? parsed.slice(0, 240)
          : parsed?.errorMessage || parsed?.message || JSON.stringify(parsed).slice(0, 240);
      throw new Error(detail || `Africa's Talking SMS failed with status ${res.status}`);
    }

    return { provider: "africastalking", result: parsed, status: res.status };
  }

  console.log("📨 SMS fallback:", to, message);
  return { provider: "log" };
}

/**
 * Send WhatsApp
 */
export async function sendWhatsApp({ provider = "twilio", to, message }) {
  if (provider === "twilio" && twClient) {
    const msg = await twClient.messages.create({
      body: message,
      from: "whatsapp:" + process.env.TWILIO_WHATSAPP_FROM,
      to: "whatsapp:" + to,
    });
    return { provider: "twilio", sid: msg.sid };
  }

  console.log("💬 WhatsApp fallback:", to, message);
  return { provider: "log" };
}

/**
 * Unified patient notification
 * (USED BY WORKFLOWS)
 */
export async function notifyPatient({
  patient,
  message,
  channel = "sms",
  provider = "auto",
}) {
  if (!patient || !patient.phone) {
    throw new Error("Patient with phone number is required");
  }

  if (channel === "whatsapp") {
    return sendWhatsApp({
      provider,
      to: patient.phone,
      message,
    });
  }

  return sendSMS({
    provider,
    to: patient.phone,
    message,
  });
}

export default {
  sendSMS,
  sendWhatsApp,
  notifyPatient,
};
