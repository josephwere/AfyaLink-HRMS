// middleware/requireRole.js
import { normalizeRole } from "../utils/normalizeRole.js";
import { isPrivilegedOverrideAllowed, isReadOnlyOverrideAllowed } from "./readOnlyOverride.js";

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized",
      });
    }

    const userRole = normalizeRole(req.user.effectiveRole || req.user.role);
    const allowed = allowedRoles.map(normalizeRole);

    if (!allowed.includes(userRole)) {
      if (isPrivilegedOverrideAllowed(req)) {
        return next();
      }
      if (isReadOnlyOverrideAllowed(req)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        msg: "Forbidden: insufficient role",
        required: allowedRoles,
        current: userRole,
      });
    }

    next();
  };
};
