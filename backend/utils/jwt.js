import jwt from "jsonwebtoken";

/* ======================================================
   FAIL FAST IF SECRETS ARE MISSING
====================================================== */
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are not defined");
}

/* ======================================================
   ACCESS TOKEN (SHORT-LIVED)
====================================================== */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

/* ======================================================
   REFRESH TOKEN (LONG-LIVED)
====================================================== */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};
