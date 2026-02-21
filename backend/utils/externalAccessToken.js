import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateExternalAccessToken = (grant) => {
  const rawToken = jwt.sign(
    {
      grantId: grant._id,
      role: grant.role,
      hospital: grant.hospital,
      scope: grant.scope,
    },
    process.env.EXTERNAL_ACCESS_SECRET,
    { expiresIn: Math.floor((grant.expiresAt - Date.now()) / 1000) }
  );

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, tokenHash };
};
