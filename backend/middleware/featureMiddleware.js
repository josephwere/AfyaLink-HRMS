import Hospital from "../models/Hospital.js";

export const requireFeature = (feature) => {
  return async (req, res, next) => {
    if (!req.user?.hospital) {
      return res.status(403).json({ message: "No hospital assigned" });
    }

    const hospital = await Hospital.findById(req.user.hospital)
      .select("features")
      .lean();

    if (!hospital?.features?.[feature]) {
      return res.status(403).json({
        message: `Feature '${feature}' disabled`,
      });
    }

    next();
  };
};
