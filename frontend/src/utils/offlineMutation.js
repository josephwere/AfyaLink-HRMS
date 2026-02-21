import { enqueueOfflineAction } from "./offlineQueue";

const NON_QUEUEABLE_PREFIXES = [
  "/api/auth/",
  "/api/2fa/",
  "/api/payment-settings/reveal",
  "/api/auth/step-up/",
  "/api/offline/metrics",
];

function normalizePath(path = "") {
  if (!path) return "";
  const idx = path.indexOf("://");
  if (idx > -1) {
    try {
      return new URL(path).pathname;
    } catch {
      return path;
    }
  }
  return path;
}

function parseBodyForQueue(body) {
  if (body == null) return undefined;
  if (typeof FormData !== "undefined" && body instanceof FormData) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

export function canQueueOfflineMutation(path, method, body) {
  const m = String(method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(m)) return false;
  const p = normalizePath(path);
  if (NON_QUEUEABLE_PREFIXES.some((prefix) => p.startsWith(prefix))) return false;
  if (parseBodyForQueue(body) === null) return false;
  return true;
}

export function queueOfflineMutation({ path, method, body, feature = "GLOBAL" }) {
  const payload = parseBodyForQueue(body);
  if (payload === null) return null;
  return enqueueOfflineAction({
    path,
    method: String(method || "POST").toUpperCase(),
    body: payload,
    feature,
  });
}
