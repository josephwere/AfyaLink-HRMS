import ExternalAccessGrant from "../models/ExternalAccessGrant.js";
import { generateExternalAccessToken } from "../utils/externalAccessToken.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   HOSPITAL APPROVES GOVERNMENT / POLICE ACCESS
====================================================== */
export const approveExternalAccess = async (req, res) => {
  try {
    const {
      agency,
      officerName,
      badgeNumber,
      role,
      scope,
      reason,
      expiresAt,
      ipAllowlist = [],
    } = req.body;

    const grant = await ExternalAccessGrant.create({
      agency,
      officerName,
      badgeNumber,
      role,
      hospital: req.user.hospital,
      scope,
      reason,
      expiresAt,
      ipAllowlist,
      approvedBy: req.user._id,
    });

    const { rawToken, tokenHash } = generateExternalAccessToken(grant);

    grant.tokenHash = tokenHash;
    await grant.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "APPROVE_EXTERNAL_ACCESS",
      resource: "ExternalAccessGrant",
      resourceId: grant._id,
      hospital: req.user.hospital,
      metadata: { agency, officerName, role },
    });

    res.status(201).json({
      message: "External access approved",
      token: rawToken, // SEND ONCE
      expiresAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve access" });
  }
};
