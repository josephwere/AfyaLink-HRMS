import BreakGlass from "../models/BreakGlass.js";
import { audit } from "../utils/audit.js";

/**
 * ACTIVATE BREAK-GLASS
 * Roles: SUPER_ADMIN, HOSPITAL_ADMIN
 */
export const activateBreakGlass = async (req, res) => {
  const { reason, durationMinutes = 60 } = req.body;

  if (!reason || reason.length < 10) {
    return res.status(400).json({
      message: "Reason required (min 10 chars)",
    });
  }

  const expiresAt = new Date(
    Date.now() + durationMinutes * 60 * 1000
  );

  const record = await BreakGlass.create({
    hospital: req.user.hospitalId,
    activatedBy: req.user._id,
    reason,
    expiresAt,
  });

  await audit({
    req,
    action: "BREAK_GLASS_ACTIVATED",
    resource: "Hospital",
    resourceId: req.user.hospitalId,
    metadata: {
      expiresAt,
      reason,
    },
  });

  res.status(201).json({
    message: "Emergency access activated",
    expiresAt,
  });
};

/**
 * MANUAL DEACTIVATION
 */
export const deactivateBreakGlass = async (req, res) => {
  const record = await BreakGlass.findOneAndUpdate(
    {
      hospital: req.user.hospitalId,
      active: true,
    },
    { active: false },
    { new: true }
  );

  if (!record) {
    return res.status(404).json({
      message: "No active break-glass session",
    });
  }

  await audit({
    req,
    action: "BREAK_GLASS_DEACTIVATED",
    resource: "Hospital",
    resourceId: req.user.hospitalId,
  });

  res.json({ message: "Emergency access revoked" });
};
