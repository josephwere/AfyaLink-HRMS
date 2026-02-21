import jwt from "jsonwebtoken";
import crypto from "crypto";
import ExternalAccessGrant from "../models/ExternalAccessGrant.js";
import AuditLog from "../models/AuditLog.js";

export const externalAccessGuard = (requiredScope) => async (req, res, next) => {
  try {
    const token = req.headers["x-external-token"];
    if (!token) {
      return res.status(401).json({ message: "External token required" });
    }

    const decoded = jwt.verify(token, process.env.EXTERNAL_ACCESS_SECRET);

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const grant = await ExternalAccessGrant.findOne({
      _id: decoded.grantId,
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!grant) {
      return res.status(403).json({ message: "Invalid or expired access" });
    }

    if (!grant.scope.includes(requiredScope)) {
      return res.status(403).json({ message: "Scope not permitted" });
    }

    if (
      grant.ipAllowlist?.length &&
      !grant.ipAllowlist.includes(req.ip)
    ) {
      return res.status(403).json({ message: "IP not allowed" });
    }

    /* ===== AUDIT EVERY QUERY ===== */
    await AuditLog.create({
      actorRole: grant.role,
      action: "EXTERNAL_ACCESS",
      resource: requiredScope,
      hospital: grant.hospital,
      ip: req.ip,
      metadata: {
        agency: grant.agency,
        officer: grant.officerName,
        badgeNumber: grant.badgeNumber,
        reason: grant.reason,
      },
    });

    req.externalAccess = grant;
    next();
  } catch (err) {
    return res.status(401).json({ message: "External access denied" });
  }
};
