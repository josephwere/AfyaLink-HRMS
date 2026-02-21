import { hasPermission } from "../utils/hasPermission.js";
import { denyAudit } from "./denyAudit.js";

export const policyGuard = (resource, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const allowed = hasPermission(req.user, resource, action, req);
    if (!allowed) {
      await denyAudit(req, res, `POLICY denied -> ${resource}:${action}`);
      return res.status(403).json({
        message: "Forbidden by policy",
        resource,
        action,
      });
    }
    return next();
  };
};

