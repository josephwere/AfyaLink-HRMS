import crypto from "crypto";

export function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `"${k}":${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

export function signPayload({ secret, payload }) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature({ secret, payload, signature }) {
  const hmac = signPayload({ secret, payload });
  const sigBuf = Buffer.from(signature || "", "hex");
  const hmacBuf = Buffer.from(hmac, "hex");
  if (sigBuf.length !== hmacBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, hmacBuf);
}
