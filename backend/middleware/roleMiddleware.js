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
import { hasPermission } from "../utils/hasPermission.js";
import { audit } from "../utils/audit.js";

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

export const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (hasPermission(req.user, resource, action, req)) {
      return next();
    }

    if (isPrivilegedOverrideAllowed(req)) {
      return next();
    }
    if (isReadOnlyOverrideAllowed(req)) {
      return next();
    }

    // Record denial audit for accountability. Add resource-specific details when possible.
    try {
      if (resource === "beds") {
        // lazy import to avoid cycles
        const Bed = (await import("../models/Bed.js")).default;
        const bed = req.params?.id ? await Bed.findById(req.params.id).lean().catch(() => null) : null;
        const allowedWards = Array.isArray(req.user?.metadata?.wardAccess)
          ? req.user.metadata.wardAccess
          : req.user?.metadata?.wardAccess
          ? [req.user.metadata.wardAccess]
          : [];
        await audit({
          req,
          action: "BED_ACCESS_DENIED",
          resource: "Bed",
          resourceId: bed?._id || null,
          success: false,
          error: "Forbidden: insufficient permissions",
          metadata: {
            role: req.user.role,
            requestedWard: bed?.ward || null,
            allowedWards,
          },
        });
      } else {
        await audit({
          req,
          action: `${String(resource || "").toUpperCase()}_ACCESS_DENIED`,
          resource: resource ? String(resource).replace(/s$/i, "") : resource,
          resourceId: req.params?.id || null,
          success: false,
          error: "Forbidden: insufficient permissions",
          metadata: { role: req.user.role },
        });
      }
    } catch (err) {
      console.error("audit on deny failed:", err?.message || err);
    }

    return res.status(403).json({
      message: "Forbidden: insufficient permissions",
    });
  };
};
