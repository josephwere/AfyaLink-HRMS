import { normalizeRole } from "../utils/normalizeRole.js";

export const superContext = (req, res, next) => {
  if (normalizeRole(req.user.role) === "SUPER_ADMIN" && req.headers["x-hospital"]) {
    req.tenant = { hospitalId: req.headers["x-hospital"] };
  }
  next();
};
