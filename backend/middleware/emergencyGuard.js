import EmergencyState from "../models/EmergencyState.js";

export const emergencyGuard = async (req, res, next) => {
  const state = await EmergencyState.findOne({
    hospital: req.user.hospital,
    active: true,
  });

  if (!state) return next();

  const allowed = ["SECURITY_ADMIN", "SUPER_ADMIN"];

  if (!allowed.includes(req.user.role)) {
    return res.status(423).json({
      message: "Hospital is in emergency lockdown",
      reason: state.reason,
    });
  }

  next();
};
