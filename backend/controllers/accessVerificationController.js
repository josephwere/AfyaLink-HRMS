import jwt from "jsonwebtoken";
import AccessEntry from "../models/AccessEntry.js";
import AuditLog from "../models/AuditLog.js";
import { isEmergencyActive } from "../utils/isEmergencyActive.js";

/* ======================================================
   🔍 VERIFY QR TOKEN (ONLINE / MOBILE SCAN)
====================================================== */
export const verifyQRToken = async (req, res) => {
  try {
    const { qrToken, area } = req.body;

    if (!qrToken) {
      return res.status(400).json({
        status: "DENIED",
        reason: "QR token required",
      });
    }

    const decoded = jwt.verify(qrToken, process.env.QR_SECRET);

    const accessEntry = await AccessEntry.findOne({
      code: decoded.code,
      hospital: decoded.hospital,
      active: true,
    }).populate("personRef");

    if (!accessEntry) {
      return res.status(404).json({
        status: "DENIED",
        reason: "Invalid or revoked access",
      });
    }

    if (accessEntry.expiresAt && accessEntry.expiresAt < new Date()) {
      return res.status(403).json({
        status: "DENIED",
        reason: "Access expired",
      });
    }

    if (area && accessEntry.areasAllowed?.length) {
      if (!accessEntry.areasAllowed.includes(area)) {
        return res.status(403).json({
          status: "DENIED",
          reason: "Area not allowed",
        });
      }
    }

    res.json({
      status: "VALID",
      person: {
        name:
          accessEntry.personRef?.fullName ||
          accessEntry.personRef?.name ||
          "Staff",
        type: accessEntry.personType,
      },
      expiresAt: accessEntry.expiresAt,
    });
  } catch (error) {
    return res.status(401).json({
      status: "DENIED",
      reason: "Invalid QR token",
    });
  }
};

/* ======================================================
   🔍 VERIFY ACCESS CODE (MANUAL / SECURITY DESK)
   🧨 EMERGENCY MODE BYPASS ENABLED
====================================================== */
export const verifyAccessCode = async (req, res) => {
  try {
    const { code, area } = req.body;
    const hospital = req.user.hospital;

    if (!code) {
      return res.status(400).json({
        status: "DENIED",
        reason: "Access code required",
      });
    }

    const access = await AccessEntry.findOne({ code, hospital })
      .populate("personRef", "name fullName email phone")
      .populate("approvedBy", "name role");

    if (!access) {
      return res.status(404).json({
        status: "DENIED",
        reason: "Invalid code",
      });
    }

    const emergency = await isEmergencyActive(hospital);
    let violation = null;

    if (access.status === "REVOKED") {
      violation = "Access revoked";
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      violation = "Expired access";
    }

    if (
      area &&
      access.areasAllowed?.length &&
      !access.areasAllowed.includes(area)
    ) {
      violation = "Area not allowed";
    }

    /* ======================================================
       🚫 DENY ONLY IF NOT IN EMERGENCY
    ====================================================== */
    if (violation && !emergency) {
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "ACCESS_DENIED",
        resource: "AccessEntry",
        resourceId: access._id,
        hospital,
        success: false,
        metadata: { area, violation, emergency },
      });

      return res.status(403).json({
        status: "DENIED",
        reason: violation,
      });
    }

    /* ======================================================
       📜 AUDIT (ALWAYS)
    ====================================================== */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: emergency && violation
        ? "EMERGENCY_ACCESS_OVERRIDE"
        : "VERIFY_ACCESS",
      resource: "AccessEntry",
      resourceId: access._id,
      hospital,
      success: true,
      metadata: {
        area,
        violation,
        emergency,
      },
    });

    /* ======================================================
       ✅ RESPONSE FOR FRONTEND
    ====================================================== */
    res.json({
      status: violation ? "WARNING" : "VALID",
      emergency,
      personType: access.personType,
      person: access.personRef,
      purpose: access.purpose,
      expiresAt: access.expiresAt,
      approvedBy: access.approvedBy,
    });
  } catch (err) {
    console.error("Verify access error:", err);
    res.status(500).json({
      status: "DENIED",
      reason: "Verification failed",
    });
  }
};

/* ======================================================
   🚪 CHECK-IN (ENTRY)
====================================================== */
export const checkIn = async (req, res) => {
  try {
    const { code } = req.body;

    const access = await AccessEntry.findOne({
      code,
      status: "ACTIVE",
    });

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
export const checkOut = async (req, res) => {
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
