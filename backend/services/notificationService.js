import Twilio from "twilio";
import fetch from "node-fetch";

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
  getSmsProviderStatus,
};
