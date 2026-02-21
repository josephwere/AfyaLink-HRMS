import crypto from "crypto";

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function signProvenance(payload, context = {}) {
  const secret = process.env.PROVENANCE_SIGNING_SECRET || process.env.JWT_SECRET || "afyalink-dev-secret";
  const canonical = stableStringify(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  return {
    algorithm: "HMAC-SHA256",
    signature,
    signedAt: new Date().toISOString(),
    context,
  };
}

export function verifyProvenance(payload, signature) {
  if (!signature) return { valid: false, reason: "MISSING_SIGNATURE" };
  const generated = signProvenance(payload, {}).signature;
  const valid = generated === String(signature);
  return {
    valid,
    reason: valid ? "OK" : "SIGNATURE_MISMATCH",
    expectedSignature: generated,
  };
}
