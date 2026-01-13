import BreakGlass from "../models/BreakGlass.js";

export const isEmergencyActive = async (hospital) => {
  return await BreakGlass.exists({
    hospital,
    active: true,
    expiresAt: { $gt: new Date() },
  });
};
