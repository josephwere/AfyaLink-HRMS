import fs from "fs";
import crypto from "crypto";
import path from "path";

function resolvePublicKey() {
  const explicitPath = process.env.PKI_PUBLIC_KEY_PATH;
  const defaultPath = path.resolve("backend/keys/public.pem");
  const filePath = explicitPath ? path.resolve(explicitPath) : defaultPath;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

export const verifySignature = (data, signature) => {
  const publicKey = resolvePublicKey();
  if (!publicKey || !signature) return false;
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(String(data || ""));
    verifier.end();
    return verifier.verify(publicKey, String(signature), "base64");
  } catch {
    return false;
  }
};

export const verifySignatureWithReason = (data, signature) => {
  if (!signature) {
    return { verified: false, reason: "SIGNATURE_MISSING" };
  }
  const publicKey = resolvePublicKey();
  if (!publicKey) {
    return { verified: false, reason: "PUBLIC_KEY_MISSING" };
  }
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(String(data || ""));
    verifier.end();
    const verified = verifier.verify(publicKey, String(signature), "base64");
    return { verified, reason: verified ? null : "SIGNATURE_INVALID" };
  } catch {
    return { verified: false, reason: "SIGNATURE_VERIFY_ERROR" };
  }
};
