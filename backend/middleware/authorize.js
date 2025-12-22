import { hasPermission } from "../utils/hasPermission.js";

export const authorize = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const allowed = hasPermission(
      req.user,
      resource,
      action,
      req
    );

    if (!allowed) {
      return res.status(403).json({
        msg: "Forbidden",
        resource,
        action,
      });
    }

    next();
  };
};
