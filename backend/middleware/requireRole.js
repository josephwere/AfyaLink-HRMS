// middleware/requireRole.js
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        msg: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        msg: "Forbidden: insufficient role",
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};
