const HUMAN_ACCOUNT_ROLES = new Set([
  "PATIENT",
  "GUEST",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "RADIOLOGIST",
  "THERAPIST",
  "LAB_TECH",
  "PHARMACIST",
  "RECEPTIONIST",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
  "COMMUNITY_HEALTH_WORKER",
  "DRIVER",
  "AMBULANCE_DRIVER",
  "MORTUARY_STAFF",
  "MORTUARY_MANAGER",
  "SUPER_ASSISTANT",
]);

const SERVICE_ACCOUNT_TYPES = new Set([
  "service",
  "system",
  "automation",
  "bot",
  "monitoring",
  "worker",
  "scheduler",
]);

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeContextValue(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (["work", "work_mode", "workmode"].includes(raw)) return "WORK";
  if (["my_health", "my-health", "myhealth", "patient", "patient_context"].includes(raw)) return "MY_HEALTH";
  return null;
}

function isServiceLikeAccount(user = null) {
  if (!user) return false;
  if (user.isServiceAccount || user.isBotAccount || user.isAutomationAccount || user.isSystemAccount) {
    return true;
  }
  if (user.accountType) {
    const accountType = String(user.accountType).trim().toLowerCase();
    if (SERVICE_ACCOUNT_TYPES.has(accountType)) return true;
  }
  return false;
}

export function canUseMyHealthContext(user = null) {
  if (!user) return false;
  if (isServiceLikeAccount(user)) return false;
  const role = normalizeRole(user.role || user.actualRole || user.currentRole || "");
  return HUMAN_ACCOUNT_ROLES.has(role);
}

function inferDefaultContext(user = null) {
  if (!user) return "WORK";
  const role = normalizeRole(user.role || user.actualRole || user.currentRole || "");
  if (role === "PATIENT" || role === "GUEST") return "MY_HEALTH";
  return "WORK";
}

export function buildAllowedContexts(user = null) {
  if (!user) return ["WORK"];
  if (!canUseMyHealthContext(user)) return ["WORK"];

  const role = normalizeRole(user.role || user.actualRole || user.currentRole || "");
  if (role === "PATIENT" || role === "GUEST") return ["MY_HEALTH"];
  return ["WORK", "MY_HEALTH"];
}

export function resolveApplicationContext(req, user = null) {
  const headers = req?.headers || {};
  const rawContext = [
    headers["x-afyalink-context"],
    headers["x-afya-link-context"],
    headers["x-afyalink-mode"],
    headers["x-afya-context"],
    req?.query?.context,
    req?.body?.context,
  ].find((value) => value !== undefined && value !== null && value !== "");

  if (rawContext !== undefined) {
    const normalized = normalizeContextValue(rawContext);
    if (!normalized) {
      return { valid: false, reason: "INVALID_CONTEXT" };
    }
    return { valid: true, context: normalized, source: "header" };
  }

  return { valid: true, context: inferDefaultContext(user), source: "default" };
}

export function enforceApplicationContext(req, res, next) {
  if (!req?.user) {
    return next();
  }

  const result = resolveApplicationContext(req, req.user);
  if (!result.valid) {
    return res.status(400).json({
      message: "Invalid application context",
      code: "INVALID_CONTEXT",
    });
  }

  const allowedContexts = buildAllowedContexts(req.user);
  req.user.allowedContexts = allowedContexts;

  if (!allowedContexts.includes(result.context)) {
    return res.status(403).json({
      message: "Requested context is not allowed for this account",
      code: "CONTEXT_NOT_ALLOWED",
      requested: result.context,
      allowed: allowedContexts,
    });
  }

  const resolvedContext = {
    mode: result.context,
    source: result.source,
    organizationId: req.user?.hospital || req.user?.organizationId || null,
    allowedContexts,
    switchedAt: Date.now(),
  };

  req.applicationContext = result.context;
  req.contextMode = result.context;
  req.contextSource = result.source;
  req.context = resolvedContext;
  req.contextMetadata = resolvedContext;
  return next();
}

export function requireContext(...contexts) {
  return (req, res, next) => {
    if (!req?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentContext = req.context?.mode || req.applicationContext || req.contextMode || "WORK";
    if (!contexts.includes(currentContext)) {
      return res.status(403).json({
        message: "Requested route is not available in the current context",
        code: "WRONG_CONTEXT",
        required: contexts,
        current: currentContext,
      });
    }

    return next();
  };
}

export function normalizeContextMode(value) {
  return normalizeContextValue(value) || "WORK";
}
