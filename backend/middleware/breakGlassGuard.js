import BreakGlass from "../models/BreakGlass.js";
import mongoose from "mongoose";

/**
 * Allows bypass ONLY if active & not expired
 */
export const isBreakGlassActive = async (hospitalId) => {
  if (!hospitalId || !mongoose.isValidObjectId(hospitalId)) {
    return false;
  }

  const now = new Date();

  const record = await BreakGlass.findOne({
    hospital: hospitalId,
    active: true,
    expiresAt: { $gt: now },
  }).lean();

  return !!record;
};
