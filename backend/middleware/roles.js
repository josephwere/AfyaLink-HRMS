import { normalizeRole } from "../utils/normalizeRole.js";
import { isReadOnlyOverrideAllowed } from "./readOnlyOverride.js";

/* ======================================================
   ROLE-BASED ACCESS CONTROL
====================================================== */
export const allowRoles = (...roles) => {
  const allowed = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRole = normalizeRole(req.user.role);
    if (!allowed.includes(userRole)) {
      if (isReadOnlyOverrideAllowed(req)) {
        return next();
      }
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};
