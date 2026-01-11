import AccessEntry from "../models/AccessEntry.js";
import Visitor from "../models/Visitor.js"; 
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { generateAccessCode } from "../utils/accessCodeGenerator.js";

/* ======================================================
   👥 VISITOR SELF / STAFF BOOKING
====================================================== */
export const bookVisitorAccess = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      idNumber,
      purpose,
      areasAllowed = [],
      expiresAt,
    } = req.body;

    if (!fullName || !phone || !purpose || !expiresAt) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const hospital = req.user.hospital;

    /* ========= FIND OR CREATE VISITOR ========= */
    let visitor = await Visitor.findOne({ phone, hospital });
    if (!visitor) {
      visitor = await Visitor.create({
        fullName,
        phone,
        idNumber,
        hospital,
      });
    }

    if (visitor.blacklisted) {
      return res.status(403).json({
        message: "Visitor is blacklisted and cannot access hospital",
      });
    }

    /* ========= CREATE ACCESS ENTRY ========= */
    const accessEntry = await AccessEntry.create({
      code: generateAccessCode(),
      hospital,
      personType: "VISITOR",
      personRef: visitor._id,
      personModel: "Visitor",
      purpose,
      areasAllowed,
      expiresAt,
      approvedBy: req.user._id,
      metadata: {
        phone,
        idNumber,
      },
    });

    /* ========= AUDIT LOG ========= */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CREATE_VISITOR_ACCESS",
      resource: "AccessEntry",
      resourceId: accessEntry._id,
      hospital,
      metadata: {
        accessCode: accessEntry.code,
        visitor: fullName,
      },
    });

    res.status(201).json({
      success: true,
      message: "Visitor access booked successfully",
      accessCode: accessEntry.code,
      expiresAt,
    });
  } catch (error) {
    console.error("Visitor booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to book visitor access",
    });
  }
};

/* ======================================================
   🧑‍⚕️ STAFF / CONTRACTOR / VENDOR BOOKING
====================================================== */
export const bookStaffOrContractorAccess = async (req, res) => {
  try {
    const {
      personType,     // STAFF | CONTRACTOR | VENDOR
      personRef,      // User._id
      purpose,
      areasAllowed = [],
      expiresAt,
    } = req.body;

    if (!personType || !personRef || !purpose || !expiresAt) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const hospital = req.user.hospital;

    /* ========= VALIDATE USER ========= */
    const user = await User.findOne({
      _id: personRef,
      hospital,
      active: true,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found or inactive",
      });
    }

    /* ========= CREATE ACCESS ENTRY ========= */
    const accessEntry = await AccessEntry.create({
      code: generateAccessCode(),
      hospital,
      personType,
      personRef: user._id,
      personModel: "User",
      purpose,
      areasAllowed,
      expiresAt,
      approvedBy: req.user._id,
    });

    /* ========= AUDIT LOG ========= */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CREATE_INTERNAL_ACCESS",
      resource: "AccessEntry",
      resourceId: accessEntry._id,
      hospital,
      metadata: {
        accessCode: accessEntry.code,
        targetUser: user.email,
        personType,
      },
    });

    res.status(201).json({
      success: true,
      message: "Internal access granted successfully",
      accessCode: accessEntry.code,
      expiresAt,
    });
  } catch (error) {
    console.error("Internal booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to grant internal access",
    });
  }
};
