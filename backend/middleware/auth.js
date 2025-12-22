import jwt from "jsonwebtoken";

/* ======================================================
   AUTHENTICATION (JWT + 2FA ENFORCEMENT)
====================================================== */
export default function auth(req, res, next) {
  try {
    // ✅ Allow refresh endpoint to bypass access-token auth
    if (req.originalUrl === "/api/auth/refresh") {
      return next();
    }

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Missing authorization token",
      });
    }

    const token = header.split(" ")[1];

    // ✅ MUST match token creation
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    // ✅ Attach trusted user info
    req.user = {
      id: decoded.id,
      role: decoded.role,
      twoFactorVerified: decoded.twoFactorVerified,
    };

    // 🔐 Enforce 2FA only if explicitly false
    if (decoded.twoFactorVerified === false) {
      return res.status(403).json({
        message: "2FA verification required",
      });
    }

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
