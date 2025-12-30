// backend/middleware/authorize.js

import { hasPermission } from "../utils/hasPermission.js";
import { denyAudit } from "./denyAudit.js";

export const authorize = (resource, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      // ❌ Not authenticated → no audit (handled by auth middleware)
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const allowed = hasPermission(
      req.user,
      resource,
      action,
      req
    );

    if (!allowed) {
      // 🔐 AUDIT ACCESS DENIAL
      await denyAudit(
        req,
        res,
        `RBAC denied → ${resource}:${action}`
      );

      return res.status(403).json({
        msg: "Forbidden",
        resource,
        action,
      });
    }

    next();
  };
};
