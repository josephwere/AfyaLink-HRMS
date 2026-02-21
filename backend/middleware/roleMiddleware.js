// backend/middleware/roleMiddleware.js

/**
 * Role-based access control
 * Usage:
 *   permit("ADMIN")
 *   permit("ADMIN", "SUPER_ADMIN")
 *   requireRole("ADMIN")
 */

import { normalizeRole } from "../utils/normalizeRole.js";
import { isPrivilegedOverrideAllowed, isReadOnlyOverrideAllowed } from "./readOnlyOverride.js";

export const permit = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated",
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
        message: "Forbidden: insufficient role",
      });
    }

    next();
  };
};

/**
 * Alias for compatibility with routes expecting `requireRole`
 */
export const requireRole = (...roles) => permit(...roles);
