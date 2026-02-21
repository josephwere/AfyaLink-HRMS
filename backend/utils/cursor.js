import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function unbase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getCursorSecret() {
  return (
    process.env.CURSOR_SIGNING_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "afyalink-dev-cursor-secret-change-me"
  );
}

function signPayload(payloadB64) {
  return crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function encodeCursor(payload) {
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function decodeCursor(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(unbase64url(payloadB64));
  } catch {
    return null;
  }
}

