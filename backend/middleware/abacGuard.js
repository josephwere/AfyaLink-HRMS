import { evaluateAbac } from "../utils/abacEngine.js";
import { logAudit } from "../services/auditService.js";

export const abacGuard = ({
  domain,
  resource,
  action,
  fallbackAllow = true,
  contextResolver = null,
}) => {
  return async (req, res, next) => {
    try {
      if (typeof contextResolver === "function") {
        const extra = await contextResolver(req);
        if (extra && typeof extra === "object") {
          req.resource = { ...(req.resource || {}), ...extra };
        }
      }
      const decision = await evaluateAbac({
        domain,
        resource,
        action,
        req,
        fallbackAllow,
      });
      if (!decision.allowed) {
        await logAudit({
          actorId: req.user?._id,
          actorRole: req.user?.role,
          action: "ABAC_DENIED",
          resource: "abac_policy",
          hospital: req.user?.hospital || req.user?.hospitalId || null,
          after: {
            domain,
            resource,
            action,
            reason: decision.reason,
            policyId: decision.matchedPolicy?._id || null,
          },
          ip: req.ip,
          userAgent: req.get?.("user-agent"),
          success: false,
          error: decision.reason,
        });
        return res.status(403).json({
          message: "Forbidden by ABAC policy",
          domain,
          resource,
          action,
          reason: decision.reason,
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
};
