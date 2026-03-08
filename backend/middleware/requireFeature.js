import Hospital from "../models/Hospital.js";

export const requireFeature = (feature) => {
  return async (req, res, next) => {
    let hospital = req.user?.hospital || null;
    if (hospital && !hospital.features) {
      hospital = await Hospital.findById(hospital).select("features").lean();
    }

    if (!hospital?.features?.[feature]) {
      return res.status(403).json({
        message: `Feature '${feature}' is disabled for this hospital`,
      });
    }

    next();
  };
};
