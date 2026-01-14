import fs from "fs";
import crypto from "crypto";
import path from "path";

const PRIVATE_KEY = fs.readFileSync(
  path.resolve("backend/keys/private.pem"),
  "utf8"
);

export const signData = (data) => {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();

  return signer.sign(PRIVATE_KEY, "base64");
};
