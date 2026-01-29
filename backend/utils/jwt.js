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
export const signAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorVerified: user.twoFactorVerified || false,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

/* ======================================================
   REFRESH TOKEN (LONG-LIVED)
====================================================== */
export const signRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};
