export const superContext = (req, res, next) => {
  if (req.user.role === "SuperAdmin" && req.headers["x-hospital"]) {
    req.tenant = { hospitalId: req.headers["x-hospital"] };
  }
  next();
};
