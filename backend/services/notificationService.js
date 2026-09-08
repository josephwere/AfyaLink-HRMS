import Twilio from "twilio";
import fetch from "node-fetch";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const trimEnv = (key) => String(process.env[key] || "").trim();
const isAccountSid = (value) => /^AC[a-f0-9]{32}$/i.test(String(value || "").trim());
const isApiKeySid = (value) => /^SK[a-f0-9]{32}$/i.test(String(value || "").trim());
const isMessagingServiceSid = (value) => /^MG[a-f0-9]{32}$/i.test(String(value || "").trim());

function resolveTwilioConfig() {
  const accountSidRaw = trimEnv("TWILIO_ACCOUNT_SID") || trimEnv("TWILIO_SID");
  const apiKeySidRaw = trimEnv("TWILIO_API_KEY_SID") || trimEnv("TWILIO_API_KEY");
  const authToken = trimEnv("TWILIO_AUTH_TOKEN");
  const apiKeySecret = trimEnv("TWILIO_API_KEY_SECRET") || trimEnv("TWILIO_API_SECRET");
  const from =
    trimEnv("TWILIO_NUMBER") ||
    trimEnv("TWILIO_PHONE_NUMBER") ||
    trimEnv("TWILIO_FROM");
  const messagingServiceSid = trimEnv("TWILIO_MESSAGING_SERVICE_SID");

  const accountSid = isAccountSid(accountSidRaw)
    ? accountSidRaw
    : isAccountSid(trimEnv("TWILIO_PRIMARY_ACCOUNT_SID"))
      ? trimEnv("TWILIO_PRIMARY_ACCOUNT_SID")
      : "";
  const apiKeySid = isApiKeySid(apiKeySidRaw)
    ? apiKeySidRaw
    : isApiKeySid(accountSidRaw)
      ? accountSidRaw
      : "";
  const resolvedApiSecret = apiKeySecret || (isApiKeySid(accountSidRaw) ? authToken : "");

  if (apiKeySid) {
    if (!accountSid) {
      return {
        configured: false,
        mode: "api_key",
        error:
          "Twilio API Key SID detected. Set TWILIO_ACCOUNT_SID to your AC... Account SID and TWILIO_API_KEY_SID to the SK... key.",
      };
    }
    if (!resolvedApiSecret) {
      return {
        configured: false,
        mode: "api_key",
        error: "TWILIO_API_KEY_SECRET is required when using TWILIO_API_KEY_SID.",
      };
    }
    if (!from && !isMessagingServiceSid(messagingServiceSid)) {
      return {
        configured: false,
        mode: "api_key",
        error: "Set TWILIO_NUMBER/TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID for SMS sender.",
      };
    }
    return {
      configured: true,
      mode: "api_key",
      username: apiKeySid,
      password: resolvedApiSecret,
      accountSid,
      from,
      messagingServiceSid,
    };
  }

  if (!accountSid || !authToken) {
    return {
      configured: false,
      mode: "auth_token",
      error: "Set TWILIO_ACCOUNT_SID starting with AC and TWILIO_AUTH_TOKEN.",
    };
  }
  if (!from && !isMessagingServiceSid(messagingServiceSid)) {
    return {
      configured: false,
      mode: "auth_token",
      error: "Set TWILIO_NUMBER/TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID for SMS sender.",
    };
  }
  return {
    configured: true,
    mode: "auth_token",
    username: accountSid,
    password: authToken,
    accountSid,
    from,
    messagingServiceSid,
  };
}

let twilioCache = { key: "", client: null, config: null };

function getTwilioClient() {
  const config = resolveTwilioConfig();
  if (!config.configured) return { config, client: null };

  const key = [
    config.mode,
    config.username,
    config.password,
    config.accountSid,
    config.from,
    config.messagingServiceSid,
  ].join("|");
  if (twilioCache.key !== key) {
    twilioCache = {
      key,
      config,
      client: new Twilio(config.username, config.password, {
        accountSid: config.accountSid,
      }),
    };
  }
  return twilioCache;
}

function resolveAfricaTalkingConfig() {
  return {
    apiKey: trimEnv("AFRICASTALKING_API_KEY") || trimEnv("AT_API_KEY"),
    username: trimEnv("AFRICASTALKING_USERNAME") || trimEnv("AT_USERNAME"),
  };
}

export function getSmsProviderStatus() {
  const twilio = resolveTwilioConfig();
  const africa = resolveAfricaTalkingConfig();
  return {
    twilio: {
      configured: Boolean(twilio.configured),
      mode: twilio.mode,
      hasSender: Boolean(twilio.from || twilio.messagingServiceSid),
      error: twilio.configured ? null : twilio.error,
    },
    africastalking: {
      configured: Boolean(africa.apiKey && africa.username),
    },
  };
}

/**
 * Send SMS
 */
export async function sendSMS({ provider = "auto", to, message }) {
  if (!to) {
    throw new Error("SMS recipient phone number is required");
  }
  if (!message) {
    throw new Error("SMS message is required");
  }

  const { config: twilioConfig, client: twClient } = getTwilioClient();
  const africa = resolveAfricaTalkingConfig();
  const resolvedProvider =
    provider === "auto"
      ? twClient
        ? "twilio"
        : africa.apiKey && africa.username
          ? "africastalking"
          : "log"
      : provider;

  if (resolvedProvider === "twilio" && twClient) {
    const payload = {
      body: message,
      to,
    };
    if (twilioConfig.messagingServiceSid) {
      payload.messagingServiceSid = twilioConfig.messagingServiceSid;
    } else {
      payload.from = twilioConfig.from;
    }
    const msg = await twClient.messages.create(payload);
    return { provider: "twilio", sid: msg.sid, status: msg.status };
  }

  if (resolvedProvider === "twilio" && !twClient) {
    throw new Error(twilioConfig?.error || "Twilio SMS is not configured");
  }

  if (resolvedProvider === "africastalking" && africa.apiKey && africa.username) {
    const res = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: africa.apiKey,
        },
        body: new URLSearchParams({
          username: africa.username,
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

  if (resolvedProvider === "africastalking") {
    throw new Error("Africa's Talking SMS is not configured");
  }

  console.log("SMS fallback selected; no live SMS provider is configured.", {
    to: String(to).replace(/.(?=.{4})/g, "*"),
  });
  return { provider: "log" };
}

/**
 * Send WhatsApp
 */
export async function sendWhatsApp({ provider = "twilio", to, message }) {
  if (!to) {
    throw new Error("WhatsApp recipient phone number is required");
  }
  if (!message) {
    throw new Error("WhatsApp message is required");
  }

  const { config: twilioConfig, client: twClient } = getTwilioClient();
  const whatsappFrom = trimEnv("TWILIO_WHATSAPP_FROM");

  if (provider === "twilio" && twClient && whatsappFrom) {
    const msg = await twClient.messages.create({
      body: message,
      from: "whatsapp:" + whatsappFrom,
      to: "whatsapp:" + to,
    });
    return { provider: "twilio", sid: msg.sid };
  }

  if (provider === "twilio") {
    throw new Error(
      !twClient
        ? twilioConfig?.error || "Twilio WhatsApp is not configured"
        : "TWILIO_WHATSAPP_FROM is required for WhatsApp delivery"
    );
  }

  console.log("WhatsApp fallback selected; no live WhatsApp provider is configured.", {
    to: String(to).replace(/.(?=.{4})/g, "*"),
  });
  return { provider: "log" };
}

/**
 * Unified patient notification
 * (USED BY WORKFLOWS)
 */
export async function notify({
  hospital = null,
  user = null,
  title,
  body,
  category = "SYSTEM",
  meta = {},
  read = false,
}) {
  if (!title || !body) {
    throw new Error("Notification title and body are required");
  }

  const idempotencyKey = meta?.idempotencyKey ? String(meta.idempotencyKey) : "";
  if (idempotencyKey) {
    const existing = await Notification.findOne({ "meta.idempotencyKey": idempotencyKey });
    if (existing) return existing;
  }
  return Notification.create({
    title,
    body,
    category,
    user,
    hospital,
    read,
    meta,
  });
}

/**
 * Notify all users in a hospital matching the given roles.
 * roles: array of role strings (e.g. ['HOSPITAL_ADMIN','PHARMACIST'])
 */
export const NOTIFICATION_TYPES = {
  APPOINTMENT_BOOKED: "APPOINTMENT_BOOKED",
  PATIENT_CHECKED_IN: "PATIENT_CHECKED_IN",
  CONSULTATION_COMPLETED: "CONSULTATION_COMPLETED",
  PRESCRIPTION_CREATED: "PRESCRIPTION_CREATED",
  PRESCRIPTION_DISPENSED: "PRESCRIPTION_DISPENSED",
  INVENTORY_LOW: "INVENTORY_LOW",
  LAB_RESULTS_READY: "LAB_RESULTS_READY",
  RADIOLOGY_COMPLETED: "RADIOLOGY_COMPLETED",
  HOSPITAL_VERIFIED: "HOSPITAL_VERIFIED",
  HOSPITAL_REVIEW_DECISION: "HOSPITAL_REVIEW_DECISION",
  BRANCH_REGISTERED: "BRANCH_REGISTERED",
  CLAIM_HIGH_RISK: "CLAIM_HIGH_RISK",
  CLAIM_ASSIGNED: "CLAIM_ASSIGNED",
  INSPECTION_SCHEDULED: "INSPECTION_SCHEDULED",
  ENFORCEMENT_ACTION_CREATED: "ENFORCEMENT_ACTION_CREATED",
  PHARMACY_COVERAGE_RISK: "PHARMACY_COVERAGE_RISK",
  NURSE_ESCALATION: "NURSE_ESCALATION",
};

export async function notifyRolesInHospital({ hospital, roles = [], title, body, category = "SYSTEM", meta = {} }) {
  if (!hospital || !Array.isArray(roles) || !roles.length || !title || !body) return null;
  const normalized = roles.map((r) => String(r || "").toUpperCase());
  const recipients = await User.find({ hospital, role: { $in: normalized }, active: true }).select("_id role name").lean();
  if (!recipients || !recipients.length) return null;
  const recallId = meta?.recallId ? String(meta.recallId) : "";
  const batchId = meta?.batchId ? String(meta.batchId) : "";
  const existing = recallId ? await Notification.find({ hospital, category, "meta.recallId": recallId, "meta.batchId": batchId }).select("user").lean() : [];
  const existingUsers = new Set(existing.map((notification) => String(notification.user)));
  const idempotencyKey = meta?.idempotencyKey ? String(meta.idempotencyKey) : "";
  const keyedRecipients = idempotencyKey ? await Notification.find({ "meta.idempotencyKey": { $in: recipients.map((recipient) => `${idempotencyKey}:${String(recipient._id)}`) } }).select("user").lean() : [];
  const keyedUsers = new Set(keyedRecipients.map((notification) => String(notification.user)));
  const docs = recipients.filter((recipient) => !existingUsers.has(String(recipient._id)) && !keyedUsers.has(String(recipient._id))).map((r) => ({
    title,
    body,
    category,
    user: r._id,
    hospital,
    meta: { ...meta, ...(idempotencyKey ? { idempotencyKey: `${idempotencyKey}:${String(r._id)}` } : {}) },
  }));
  if (!docs.length) return [];
  try {
    return Notification.insertMany(docs);
  } catch (err) {
    console.error("notifyRolesInHospital failed:", err);
    return null;
  }
}

export async function notifyUsers({ users = [], hospital = null, title, body, category = "SYSTEM", meta = {}, read = false }) {
  if (!Array.isArray(users) || !users.length || !title || !body) return null;
  const userIds = users
    .map((u) => (typeof u === "object" ? String(u._id || u.id || "") : String(u || "")))
    .filter(Boolean);
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) return null;
  const docs = uniqueIds.map((user) => ({
    title,
    body,
    category,
    user,
    hospital,
    read,
    meta,
  }));
  try {
    return Notification.insertMany(docs);
  } catch (err) {
    console.error("notifyUsers failed:", err);
    return null;
  }
}

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
  notify,
  notifyPatient,
  getSmsProviderStatus,
};
