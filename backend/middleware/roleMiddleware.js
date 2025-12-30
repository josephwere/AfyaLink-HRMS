// backend/middleware/roleMiddleware.js

/**
 * Role-based access control
 * Usage:
 *   permit("ADMIN")
 *   permit("ADMIN", "SUPER_ADMIN")
 *   requireRole("ADMIN")
 */

export const permit = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
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
