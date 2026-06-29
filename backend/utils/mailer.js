import axios from "axios";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function splitRecipients(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => splitRecipients(item));
  if (typeof value === "object" && value.email) return [value];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAddress(value) {
  if (!value) return null;
  if (typeof value === "object" && value.email) {
    return {
      email: String(value.email).trim(),
      name: value.name ? String(value.name).trim() : undefined,
    };
  }

  const raw = String(value).trim();
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const [, name, email] = match;
    return {
      email: String(email || "").trim(),
      name: String(name || "").replace(/^"+|"+$/g, "").trim() || undefined,
    };
  }
  return { email: raw };
}

function normalizeRecipientList(value) {
  return splitRecipients(value)
    .map((item) => parseAddress(item))
    .filter((item) => item?.email);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toHtml({ html, text }) {
  if (html) return String(html);
  if (!text) return "<p></p>";
  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
}

function toText({ html, text }) {
  if (text) return String(text);
  return stripHtml(html);
}

function resolveProvider() {
  if (process.env.NODE_ENV === "test") {
    return "console";
  }
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (
    process.env.SMTP_HOST ||
    process.env.SMTP_USER ||
    process.env.SMTP_PASS ||
    process.env.EMAIL_USER ||
    process.env.EMAIL_PASS
  ) {
    return "smtp";
  }
  return "console";
}

function resolveSender() {
  const explicit =
    parseAddress(process.env.BREVO_SENDER) ||
    parseAddress(process.env.BREVO_SENDER_EMAIL) ||
    parseAddress(process.env.EMAIL_FROM) ||
    parseAddress(process.env.SMTP_FROM) ||
    parseAddress(process.env.SMTP_USER) ||
    parseAddress(process.env.EMAIL_USER);

  return {
    email: explicit?.email || "no-reply@afyalink.local",
    name:
      explicit?.name ||
      String(process.env.BREVO_SENDER_NAME || process.env.APP_EMAIL_NAME || "AfyaLink HRMS").trim(),
  };
}

let smtpTransporter = null;
let sendGridConfigured = false;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "").trim() !== ""
      ? String(process.env.SMTP_SECURE).trim() === "true"
      : port === 465;

  const user = process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return smtpTransporter;
}

function ensureSendGrid() {
  if (!sendGridConfigured && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sendGridConfigured = true;
  }
}

async function sendViaBrevo({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  from,
  headers = {},
}) {
  const sender = from || resolveSender();
  const payload = {
    sender,
    to,
    subject,
    htmlContent: html,
  };

  if (text) payload.textContent = text;
  if (cc?.length) payload.cc = cc;
  if (bcc?.length) payload.bcc = bcc;
  if (replyTo?.email) payload.replyTo = replyTo;
  if (Object.keys(headers).length) payload.headers = headers;

  const response = await axios.post(BREVO_API_URL, payload, {
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: Number(process.env.EMAIL_TIMEOUT_MS || 15000),
  });

  return {
    provider: "brevo",
    ok: true,
    messageId: response.data?.messageId || null,
    response: response.data,
  };
}

async function sendViaSmtp({ to, subject, html, text, cc, bcc, replyTo, from, headers = {} }) {
  const sender = from || resolveSender();
  const transporter = getSmtpTransporter();
  const info = await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: to.map((item) => (item.name ? `"${item.name}" <${item.email}>` : item.email)).join(", "),
    cc: cc?.length ? cc.map((item) => (item.name ? `"${item.name}" <${item.email}>` : item.email)).join(", ") : undefined,
    bcc: bcc?.length ? bcc.map((item) => (item.name ? `"${item.name}" <${item.email}>` : item.email)).join(", ") : undefined,
    replyTo: replyTo?.email ? (replyTo.name ? `"${replyTo.name}" <${replyTo.email}>` : replyTo.email) : undefined,
    subject,
    html,
    text,
    headers,
  });

  return {
    provider: "smtp",
    ok: true,
    messageId: info?.messageId || null,
    response: info,
  };
}

async function sendViaSendGrid({ to, subject, html, text, cc, bcc, replyTo, from }) {
  ensureSendGrid();
  const sender = from || resolveSender();
  const [response] = await sgMail.send({
    to,
    cc: cc?.length ? cc : undefined,
    bcc: bcc?.length ? bcc : undefined,
    replyTo: replyTo?.email ? replyTo : undefined,
    from: sender,
    subject,
    html,
    text,
  });

  return {
    provider: "sendgrid",
    ok: true,
    messageId: response?.headers?.["x-message-id"] || null,
    response,
  };
}

export function getEmailProviderInfo() {
  const provider = resolveProvider();
  const sender = resolveSender();
  return {
    provider,
    sender,
    configured:
      provider === "brevo"
        ? Boolean(process.env.BREVO_API_KEY)
        : provider === "sendgrid"
          ? Boolean(process.env.SENDGRID_API_KEY)
          : provider === "smtp"
            ? Boolean(process.env.SMTP_USER || process.env.EMAIL_USER)
            : false,
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  from,
  headers,
}) {
  const recipients = normalizeRecipientList(to);
  if (!recipients.length) {
    throw new Error("Email recipient is required");
  }

  const normalizedHtml = toHtml({ html, text });
  const normalizedText = toText({ html, text });
  const normalizedCc = normalizeRecipientList(cc);
  const normalizedBcc = normalizeRecipientList(bcc);
  const normalizedReplyTo = parseAddress(replyTo);
  const normalizedFrom = parseAddress(from) || resolveSender();
  const provider = resolveProvider();

  if (provider === "brevo") {
    return sendViaBrevo({
      to: recipients,
      subject,
      html: normalizedHtml,
      text: normalizedText,
      cc: normalizedCc,
      bcc: normalizedBcc,
      replyTo: normalizedReplyTo,
      from: normalizedFrom,
      headers,
    });
  }

  if (provider === "sendgrid") {
    return sendViaSendGrid({
      to: recipients,
      subject,
      html: normalizedHtml,
      text: normalizedText,
      cc: normalizedCc,
      bcc: normalizedBcc,
      replyTo: normalizedReplyTo,
      from: normalizedFrom,
    });
  }

  if (provider === "smtp") {
    return sendViaSmtp({
      to: recipients,
      subject,
      html: normalizedHtml,
      text: normalizedText,
      cc: normalizedCc,
      bcc: normalizedBcc,
      replyTo: normalizedReplyTo,
      from: normalizedFrom,
      headers,
    });
  }

  console.warn("[mailer] Email provider not configured; returning console placeholder", {
    to: recipients.map((item) => item.email),
    subject,
  });

  return {
    provider: "console",
    ok: true,
    placeholder: true,
    to: recipients.map((item) => item.email),
    subject,
  };
}
