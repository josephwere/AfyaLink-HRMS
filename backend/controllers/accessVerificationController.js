import AccessEntry from "../models/AccessEntry.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   🔍 VERIFY ACCESS CODE (ENTRY / CHECK)
====================================================== */
export const verifyAccessCode = async (req, res) => {
  try {
    const { code, area } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Access code required" });
    }

    const access = await AccessEntry.findOne({ code })
      .populate("personRef", "name fullName email phone")
      .populate("approvedBy", "name role")
      .lean();

    if (!access) {
      return res.status(404).json({
        status: "INVALID",
        message: "Access code not found",
      });
    }

    /* ========= STATUS CHECK ========= */
    const now = new Date();

    if (access.status === "REVOKED") {
      return res.json({ status: "REVOKED" });
    }

    if (access.expiresAt && access.expiresAt < now) {
      return res.json({ status: "EXPIRED" });
    }

    /* ========= AREA CHECK ========= */
    if (area && access.areasAllowed?.length) {
      if (!access.areasAllowed.includes(area)) {
        await AuditLog.create({
          actorId: req.user._id,
          actorRole: req.user.role,
          action: "ACCESS_AREA_VIOLATION",
          resource: "AccessEntry",
          resourceId: access._id,
          hospital: access.hospital,
          metadata: { area },
          success: false,
        });

        return res.json({
          status: "AREA_VIOLATION",
          allowedAreas: access.areasAllowed,
        });
      }
    }

    /* ========= SUCCESS ========= */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ACCESS_VERIFIED",
      resource: "AccessEntry",
      resourceId: access._id,
      hospital: access.hospital,
      metadata: { area },
    });

    res.json({
      status: "VALID",
      personType: access.personType,
      person: access.personRef,
      purpose: access.purpose,
      expiresAt: access.expiresAt,
      approvedBy: access.approvedBy,
    });
  } catch (err) {
    console.error("Verify access error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

/* ======================================================
   🚪 CHECK-IN (ENTRY)
====================================================== */
export const checkInAccess = async (req, res) => {
  try {
    const { code } = req.body;

    const access = await AccessEntry.findOne({ code, status: "ACTIVE" });

    if (!access) {
      return res.status(404).json({ message: "Invalid access code" });
    }

    if (access.checkedInAt) {
      return res.json({ message: "Already checked in" });
    }

    access.checkedInAt = new Date();
    await access.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ACCESS_CHECK_IN",
      resource: "AccessEntry",
      resourceId: access._id,
      hospital: access.hospital,
    });

    res.json({ message: "Check-in successful" });
  } catch (err) {
    res.status(500).json({ message: "Check-in failed" });
  }
};

/* ======================================================
   🚪 CHECK-OUT (EXIT)
====================================================== */
export const checkOutAccess = async (req, res) => {
  try {
    const { code } = req.body;

    const access = await AccessEntry.findOne({ code });

    if (!access || !access.checkedInAt) {
      return res.status(404).json({ message: "No active check-in found" });
    }

    access.checkedOutAt = new Date();
    access.status = "EXPIRED";
    await access.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ACCESS_CHECK_OUT",
      resource: "AccessEntry",
      resourceId: access._id,
      hospital: access.hospital,
    });

    res.json({ message: "Check-out successful" });
  } catch (err) {
    res.status(500).json({ message: "Check-out failed" });
  }
};
