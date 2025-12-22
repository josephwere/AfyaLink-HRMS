import jwt from "jsonwebtoken";

/* ======================================================
   ACCESS TOKEN (SHORT-LIVED)
====================================================== */
export const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.ACCESS_SECRET, {
    expiresIn: "15m",
  });

/* ======================================================
   REFRESH TOKEN (LONG-LIVED)
====================================================== */
export const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: "14d",
  });
