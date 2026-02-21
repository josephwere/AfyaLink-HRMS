import AbacPolicy from "../models/AbacPolicy.js";
import { normalizeRole } from "./normalizeRole.js";

const DEFAULT_POLICIES = [
  {
    domain: "INTEROP",
    resource: "mapping_studio",
    action: "read",
    effect: "ALLOW",
    roles: ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
    conditions: {},
    priority: 110,
    active: true,
  },
  {
    domain: "INTEROP",
    resource: "mapping_studio",
    action: "write",
    effect: "ALLOW",
    roles: ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
    conditions: {},
    priority: 110,
    active: true,
  },
  {
    domain: "ANALYTICS",
    resource: "dashboard_insights",
    action: "read",
    effect: "ALLOW",
    roles: [
      "SUPER_ADMIN",
      "SYSTEM_ADMIN",
      "HOSPITAL_ADMIN",
      "HR_MANAGER",
      "PAYROLL_OFFICER",
      "DOCTOR",
      "DEVELOPER",
    ],
    conditions: {},
    priority: 120,
    active: true,
  },
  {
    domain: "FINANCE",
    resource: "transaction_export",
    action: "read",
    effect: "ALLOW",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "PAYROLL_OFFICER", "DEVELOPER"],
    conditions: {},
    priority: 120,
    active: true,
  },
  {
    domain: "CLINICAL",
    resource: "report_export",
    action: "read",
    effect: "ALLOW",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "DEVELOPER"],
    conditions: {},
    priority: 120,
    active: true,
  },
  {
    domain: "AI",
    resource: "clinical_intelligence",
    action: "read",
    effect: "ALLOW",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HR_MANAGER", "DOCTOR", "NURSE", "DEVELOPER"],
    conditions: {},
    priority: 130,
    active: true,
  },
  {
    domain: "INTEROP",
    resource: "transfer_export",
    action: "read",
    effect: "ALLOW",
    roles: ["DOCTOR", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"],
    conditions: {
      requireActiveConsent: true,
      requireSameHospitalOrPrivileged: true,
      requiredScopes: [],
    },
    priority: 100,
    active: true,
  },
];

function isPrivileged(role) {
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(normalizeRole(role || ""));
}

function policyAppliesToRole(policy, role) {
  if (!Array.isArray(policy.roles) || policy.roles.length === 0) return true;
  const normalized = normalizeRole(role || "");
  return policy.roles.map((r) => normalizeRole(r)).includes(normalized);
}

function evaluateConditions(policy, req) {
  const c = policy.conditions || {};
  const ctx = req?.resource || {};
  const role = req?.user?.role || "";

  if (c.requireSameHospitalOrPrivileged) {
    const sameHospital = ctx.sameHospital === true;
    if (!sameHospital && !isPrivileged(role)) return false;
  }
  if (c.requireActiveConsent) {
    const hasActiveConsent = ctx.hasActiveConsent === true;
    const sourceBypass = ctx.sourceHospitalBypass === true;
    if (!hasActiveConsent && !sourceBypass && !isPrivileged(role)) return false;
  }
  if (Array.isArray(c.requiredScopes) && c.requiredScopes.length > 0) {
    const allowed = new Set((ctx.allowedScopes || []).map((s) => String(s).toLowerCase()));
    for (const scope of c.requiredScopes) {
      if (!allowed.has(String(scope).toLowerCase())) return false;
    }
  }
  return true;
}

export async function evaluateAbac({
  domain,
  resource,
  action,
  req,
  fallbackAllow = true,
  includeTrace = false,
}) {
  const policies = await AbacPolicy.find({
    domain,
    resource,
    action,
    active: true,
  })
    .sort({ priority: 1, createdAt: 1 })
    .lean();

  const effectivePolicies = policies.length ? policies : DEFAULT_POLICIES.filter(
    (p) => p.domain === domain && p.resource === resource && p.action === action
  );

  if (!effectivePolicies.length) {
    return {
      allowed: fallbackAllow,
      reason: fallbackAllow ? "NO_POLICY_FALLBACK_ALLOW" : "NO_POLICY",
      matchedPolicy: null,
      trace: includeTrace ? [] : undefined,
    };
  }

  const role = req?.user?.role || "";
  const trace = includeTrace ? [] : null;
  for (const policy of effectivePolicies) {
    if (!policyAppliesToRole(policy, role)) {
      if (trace) trace.push({ policyId: policy._id || null, result: "SKIP_ROLE", policy });
      continue;
    }
    const conditionsPass = evaluateConditions(policy, req);
    if (!conditionsPass) {
      if (trace) trace.push({ policyId: policy._id || null, result: "SKIP_CONDITIONS", policy });
      continue;
    }
    if (policy.effect === "DENY") {
      if (trace) trace.push({ policyId: policy._id || null, result: "MATCH_DENY", policy });
      return {
        allowed: false,
        reason: "DENY_POLICY_MATCH",
        matchedPolicy: policy,
        trace: trace || undefined,
      };
    }
    if (policy.effect === "ALLOW") {
      if (trace) trace.push({ policyId: policy._id || null, result: "MATCH_ALLOW", policy });
      return {
        allowed: true,
        reason: "ALLOW_POLICY_MATCH",
        matchedPolicy: policy,
        trace: trace || undefined,
      };
    }
  }

  return {
    allowed: false,
    reason: "NO_MATCHING_POLICY",
    matchedPolicy: null,
    trace: trace || undefined,
  };
}
