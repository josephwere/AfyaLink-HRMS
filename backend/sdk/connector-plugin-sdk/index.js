import crypto from "crypto";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createHmacSignature(secret, rawBody) {
  return crypto.createHmac("sha256", String(secret || "")).update(String(rawBody || "")).digest("hex");
}

export class AfyaLinkConnectorClient {
  constructor({ baseUrl, connectorId, apiToken, webhookSecret, timeoutMs = 15000, retries = 2 }) {
    if (!baseUrl) throw new Error("baseUrl is required");
    if (!connectorId) throw new Error("connectorId is required");
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.connectorId = String(connectorId);
    this.apiToken = apiToken ? String(apiToken) : "";
    this.webhookSecret = webhookSecret ? String(webhookSecret) : "";
    this.timeoutMs = Number(timeoutMs) || 15000;
    this.retries = Number(retries) || 2;
  }

  headers(extra = {}) {
    return {
      Accept: "application/json",
      ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      ...extra,
    };
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) {
        const message = json?.message || json?.error || `Request failed (${res.status})`;
        const err = new Error(message);
        err.status = res.status;
        err.body = json || text;
        throw err;
      }
      return json ?? text;
    } finally {
      clearTimeout(t);
    }
  }

  async getManifest() {
    return this.request("/api/connectors/sdk/manifest", {
      method: "GET",
      headers: this.headers(),
      credentials: "include",
    });
  }

  async getRuntime() {
    return this.request(`/api/connectors/${this.connectorId}/runtime`, {
      method: "GET",
      headers: this.headers(),
      credentials: "include",
    });
  }

  async setRuntime({ mode, dryRun, migrationProjectId } = {}) {
    return this.request(`/api/connectors/${this.connectorId}/runtime`, {
      method: "PATCH",
      headers: this.headers({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({ mode, dryRun, migrationProjectId }),
    });
  }

  async ackCursor(cursor) {
    return this.request(`/api/connectors/${this.connectorId}/runtime/cursor`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({ cursor }),
    });
  }

  async ingest({ payload, sourceType = "JSON", idempotencyKey, eventId = "" }) {
    if (!idempotencyKey) throw new Error("idempotencyKey is required");
    const body = JSON.stringify({ payload, sourceType, idempotencyKey, eventId });

    const headers = this.headers({
      "Content-Type": "application/json",
      "x-idempotency-key": idempotencyKey,
      ...(eventId ? { "x-event-id": eventId } : {}),
    });

    if (this.webhookSecret) {
      headers["x-afya-signature"] = createHmacSignature(this.webhookSecret, body);
    }

    let attempt = 0;
    while (true) {
      try {
        return await this.request(`/api/connectors/${this.connectorId}/ingest`, {
          method: "POST",
          headers,
          credentials: "include",
          body,
        });
      } catch (err) {
        const retryable = [408, 429, 500, 502, 503, 504].includes(err.status);
        if (attempt >= this.retries || !retryable) throw err;
        attempt += 1;
        await sleep(300 * attempt);
      }
    }
  }
}

export default {
  AfyaLinkConnectorClient,
  createHmacSignature,
};
