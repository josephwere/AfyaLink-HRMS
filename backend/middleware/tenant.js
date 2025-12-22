export const tenantGuard = (req, res, next) => {
  if (!req.user?.hospital) {
    return res.status(403).json({ msg: "No hospital context" });
  }

  req.tenant = {
    hospitalId: String(req.user.hospital),
    role: req.user.role,
  };

  next();
};
