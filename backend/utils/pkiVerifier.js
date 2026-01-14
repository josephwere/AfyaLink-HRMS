import fs from "fs";
import crypto from "crypto";
import path from "path";

const PUBLIC_KEY = fs.readFileSync(
  path.resolve("backend/keys/public.pem"),
  "utf8"
);

export const verifySignature = (data, signature) => {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(data);
  verifier.end();

  return verifier.verify(PUBLIC_KEY, signature, "base64");
};
