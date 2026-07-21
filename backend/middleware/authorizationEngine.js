import { audit } from "../utils/audit.js";
import { hasPermission } from "../utils/hasPermission.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { buildAllowedContexts } from "./applicationContext.js";

const DEFAULT_CONTEXT = "WORK";

function normalizeContextValue(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "MY_HEALTH" || normalized === "WORK") return normalized;
  return normalized;
}

function resolveRequestContext(req) {
  if (req?.context?.mode) {
    return req.context;
  }

  const resolvedMode = normalizeContextValue(req?.contextMode || req?.applicationContext || req?.context || DEFAULT_CONTEXT);
  return {
    mode: resolvedMode || DEFAULT_CONTEXT,
    source: req?.contextSource || "server",
    organizationId: req.user?.hospital || req.user?.organizationId || null,
    allowedContexts: buildAllowedContexts(req.user),
    switchedAt: Date.now(),
  };
}

function isOrganizationBoundaryValid(req, resource) {
  if (!resource) return true;
  const resourceHospital = resource?.hospitalId || resource?.hospital || resource?.organizationId;
  const userHospital = req.user?.hospital || req.user?.organizationId;
  if (!resourceHospital || !userHospital) return true;
  return String(resourceHospital) === String(userHospital);
}

function isResourceOwnerValid(req, resource) {
  if (!resource) return true;
  const ownerId = resource?.ownerId || resource?.patientId || resource?.userId;
  if (!ownerId) return true;
  return String(ownerId) === String(req.user?.id || req.user?._id || req.user?.userId || "");
}

function isScopeValid(req, resource) {
  if (!resource) return true;
  const userRole = normalizeRole(req.user?.effectiveRole || req.user?.role);
  if (userRole === "DOCTOR" && resource?.doctorId) {
    return String(resource.doctorId) === String(req.user?.id || req.user?._id || req.user?.userId || "");
  }
  return true;
}

export function authorize({
  context,
  permissions = [],
  resource = null,
  requireResource = false,
  resourceParamName = "id",
} = {}) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated", code: "AUTH_REQUIRED" });
    }

    const resolvedContext = resolveRequestContext(req);
    const allowedContexts = Array.isArray(resolvedContext.allowedContexts) && resolvedContext.allowedContexts.length
      ? resolvedContext.allowedContexts
      : [DEFAULT_CONTEXT];

    if (context && !allowedContexts.includes(context)) {
      await audit({
        req,
        action: "AUTHZ_DENIED",
        resource: resource || "authorization",
        resourceId: req.params?.[resourceParamName] || null,
        success: false,
        error: "CONTEXT_NOT_ALLOWED",
        metadata: {
          context,
          allowedContexts,
          reason: "context-not-allowed",
        },
      });
      return res.status(403).json({
        code: "CONTEXT_NOT_ALLOWED",
        message: "Requested context is not allowed for this account",
        requested: context,
        allowed: allowedContexts,
      });
    }

    if (resolvedContext.mode && context && resolvedContext.mode !== context) {
      await audit({
        req,
        action: "AUTHZ_DENIED",
        resource: resource || "authorization",
        resourceId: req.params?.[resourceParamName] || null,
        success: false,
        error: "WRONG_CONTEXT",
        metadata: {
          context,
          currentContext: resolvedContext.mode,
          reason: "wrong-context",
        },
      });
      return res.status(403).json({
        code: "WRONG_CONTEXT",
        message: "Requested route is not available in the current context",
        required: [context],
        current: resolvedContext.mode,
      });
    }

    const permissionChecks = Array.isArray(permissions) ? permissions : [permissions];
    const hasAllPermissions = permissionChecks.every((permission) => hasPermission(req.user, permission?.resource || resource, permission?.action || permission, req));
    if (!hasAllPermissions) {
      await audit({
        req,
        action: "AUTHZ_DENIED",
        resource: resource || "authorization",
        resourceId: req.params?.[resourceParamName] || null,
        success: false,
        error: "PERMISSION_DENIED",
        metadata: {
          permissions: permissionChecks,
          reason: "permission-denied",
          context: resolvedContext.mode,
        },
      });
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        message: "Insufficient permissions",
      });
    }

    const requestResource = req.resource || req.body?.resource || req.query?.resource || null;
    if (requireResource && requestResource) {
      const resourceOwnerValid = isResourceOwnerValid(req, requestResource);
      const organizationValid = isOrganizationBoundaryValid(req, requestResource);
      const scopeValid = isScopeValid(req, requestResource);
      if (!resourceOwnerValid || !organizationValid || !scopeValid) {
        await audit({
          req,
          action: "AUTHZ_DENIED",
          resource: resource || requestResource?.type || "authorization",
          resourceId: requestResource?._id || req.params?.[resourceParamName] || null,
          success: false,
          error: "RESOURCE_ACCESS_DENIED",
          metadata: {
            reason: "resource-boundary-violation",
            context: resolvedContext.mode,
          },
        });
        return res.status(403).json({
          code: "RESOURCE_ACCESS_DENIED",
          message: "Resource access is not permitted in the current scope",
        });
      }
    }

    req.context = resolvedContext;
    req.contextMetadata = resolvedContext;
    req.authorized = true;
    req.authorizedPolicy = { context, permissions, resource, requireResource };
    await audit({
      req,
      action: "AUTHZ_ALLOWED",
      resource: resource || "authorization",
      resourceId: req.params?.[resourceParamName] || null,
      success: true,
      metadata: {
        context: resolvedContext.mode,
        permissions: permissionChecks,
        resourceScope: requireResource ? "enforced" : "not-required",
      },
    });
    return next();
  };
}
