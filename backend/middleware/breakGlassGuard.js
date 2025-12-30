import BreakGlass from "../models/BreakGlass.js";

/**
 * Allows bypass ONLY if active & not expired
 */
export const isBreakGlassActive = async (hospitalId) => {
  const now = new Date();

  const record = await BreakGlass.findOne({
    hospital: hospitalId,
    active: true,
    expiresAt: { $gt: now },
  }).lean();

  return !!record;
};
