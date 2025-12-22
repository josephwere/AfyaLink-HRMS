import Twilio from "twilio";
import fetch from "node-fetch";

const TW_SID = process.env.TWILIO_ACCOUNT_SID;
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TW_NUMBER = process.env.TWILIO_NUMBER;

const AT_KEY = process.env.AFRICASTALKING_API_KEY;
const AT_USER = process.env.AFRICASTALKING_USERNAME;

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
export async function sendSMS({ provider = "twilio", to, message }) {
  if (provider === "twilio" && twClient) {
    const msg = await twClient.messages.create({
      body: message,
      from: TW_NUMBER,
      to,
    });
    return { provider: "twilio", sid: msg.sid };
  }

  if (provider === "africastalking" && AT_KEY && AT_USER) {
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

    return { provider: "africastalking", result: await res.json() };
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
  provider = "twilio",
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
