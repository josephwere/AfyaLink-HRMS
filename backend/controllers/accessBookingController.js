import AccessEntry from "../models/AccessEntry.js";
import Visitor from "../models/Visitor.js";
import { generateAccessCode } from "../utils/accessCodeGenerator.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   VISITOR SELF BOOKING
====================================================== */
export const bookVisitorAccess = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      idNumber,
      purpose,
      areasAllowed,
      expiresAt,
    } = req.body;

    const hospital = req.user.hospital;

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
        message: "Visitor is blacklisted",
      });
    }

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
      metadata: { phone, idNumber },
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CREATE_VISITOR_BOOKING",
      resource: "AccessEntry",
      resourceId: accessEntry._id,
      hospital,
      metadata: { code: accessEntry.code },
    });

    res.status(201).json({
      message: "Visit booked successfully",
      accessCode: accessEntry.code,
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
