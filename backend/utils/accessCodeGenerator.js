import crypto from "crypto";

export function generateAccessCode() {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `HSP-${random}`;
}
