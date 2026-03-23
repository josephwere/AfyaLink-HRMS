import axios from "axios";

const BREVO_CONTACTS_API_URL = "https://api.brevo.com/v3/contacts";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseListIds(value) {
  return splitCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function splitName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { firstName: "", lastName: "" };
  const parts = raw.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function resolveListIdsForRole(role) {
  const globalIds = parseListIds(process.env.BREVO_CONTACT_LIST_IDS);
  const roleIds = parseListIds(process.env[`BREVO_CONTACT_LIST_IDS_${normalizeRole(role)}`]);
  return Array.from(new Set([...globalIds, ...roleIds]));
}

export function isBrevoContactSyncConfigured() {
  return Boolean(process.env.BREVO_API_KEY);
}

export async function syncBrevoContactForUser(user, options = {}) {
  if (!isBrevoContactSyncConfigured()) {
    return { ok: false, skipped: true, reason: "BREVO_API_KEY not configured" };
  }
  if (!user?.email) {
    return { ok: false, skipped: true, reason: "User has no email" };
  }

  const { firstName, lastName } = splitName(user.name);
  const listIds = options.listIds?.length ? options.listIds : resolveListIdsForRole(user.role);
  const payload = {
    email: String(user.email).trim().toLowerCase(),
    ext_id: String(user._id),
    updateEnabled: true,
    attributes: {
      FIRSTNAME: firstName || undefined,
      LASTNAME: lastName || undefined,
      SMS: user.phone ? String(user.phone).trim() : undefined,
    },
  };

  if (listIds.length) {
    payload.listIds = listIds;
  }

  const response = await axios.post(BREVO_CONTACTS_API_URL, payload, {
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: Number(process.env.EMAIL_TIMEOUT_MS || 15000),
  });

  return {
    ok: true,
    provider: "brevo",
    listIds,
    response: response.data,
  };
}

export function queueBrevoContactSync(user, options = {}) {
  if (!user) return;
  syncBrevoContactForUser(user, options).catch((err) => {
    console.error("[brevo] contact sync failed:", err?.response?.data || err?.message || err);
  });
}
