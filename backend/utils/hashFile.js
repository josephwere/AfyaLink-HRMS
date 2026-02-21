import crypto from "crypto";
import fs from "fs";

export const hashFile = (filePath) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
