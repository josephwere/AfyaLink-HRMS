export const requireFeature = (feature) => {
  return (req, res, next) => {
    const hospital = req.user.hospital;

    if (!hospital?.features?.[feature]) {
      return res.status(403).json({
        message: `Feature '${feature}' is disabled for this hospital`,
      });
    }

    next();
  };
};
