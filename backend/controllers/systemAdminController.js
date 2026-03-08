import Hospital from "../models/Hospital.js";
import Branch from "../models/Branch.js";
import User from "../models/User.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import AbacPolicy from "../models/AbacPolicy.js";
import AbacPolicyTestCase from "../models/AbacPolicyTestCase.js";
import { evaluateAbac } from "../utils/abacEngine.js";
import { getRiskPolicy, upsertRiskPolicy } from "../utils/riskPolicy.js";
import { logAudit } from "../services/auditService.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import Notification from "../models/Notification.js";
import fs from "fs/promises";

export const getSystemAdminMetrics = async (_req, res) => {
  try {
    const [hospitals, staff, leave, overtime, shifts] = await Promise.all([
      Hospital.countDocuments({ active: { $ne: false } }),
      User.countDocuments({
        role: { $nin: ["PATIENT", "GUEST"] },
        active: { $ne: false },
      }),
      LeaveRequest.countDocuments({ status: "PENDING" }),
      OvertimeRequest.countDocuments({ status: "PENDING" }),
      ShiftRequest.countDocuments({ status: "PENDING" }),
    ]);

    res.json({
      hospitals,
      staff,
      approvals: {
        leave,
        overtime,
        shifts,
        total: leave + overtime + shifts,
      },
    });
  } catch (err) {
    console.error("System admin metrics error:", err);
    res.status(500).json({ message: "Failed to load system metrics" });
  }
};

export const listGovernmentHospitalRegistry = async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    const items = await GovernmentHospitalRegistry.find(filter)
      .sort(q ? { score: { $meta: "textScore" }, officialName: 1 } : { createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("Government registry list error:", err);
    return res.status(500).json({ message: "Failed to load government registry" });
  }
};

export const createGovernmentHospitalRegistryEntry = async (req, res) => {
  try {
    const payload = {
      officialName: String(req.body?.officialName || "").trim(),
      registrationNumber: String(req.body?.registrationNumber || "").trim().toUpperCase(),
      hospitalType: String(req.body?.hospitalType || "PRIVATE").trim().toUpperCase(),
      status: String(req.body?.status || "ACTIVE").trim().toUpperCase(),
      aliases: Array.isArray(req.body?.aliases)
        ? req.body.aliases.map((v) => String(v).trim()).filter(Boolean)
        : String(req.body?.aliases || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
      location: {
        country: String(req.body?.location?.country || req.body?.country || "").trim(),
        region: String(req.body?.location?.region || req.body?.region || "").trim(),
        city: String(req.body?.location?.city || req.body?.city || "").trim(),
        address: String(req.body?.location?.address || req.body?.address || "").trim(),
      },
      contact: {
        email: String(req.body?.contact?.email || req.body?.email || "").trim(),
        phone: String(req.body?.contact?.phone || req.body?.phone || "").trim(),
      },
      approvedAt: req.body?.approvedAt ? new Date(req.body.approvedAt) : new Date(),
      validUntil: req.body?.validUntil ? new Date(req.body.validUntil) : null,
      source: {
        name: String(req.body?.source?.name || "Ministry of Health").trim(),
        referenceUrl: String(req.body?.source?.referenceUrl || "").trim(),
      },
      metadata: req.body?.metadata || {},
    };

    if (!payload.officialName || !payload.registrationNumber || !payload.location.country) {
      return res.status(400).json({ message: "officialName, registrationNumber and country are required" });
    }

    const row = await GovernmentHospitalRegistry.create(payload);
    return res.status(201).json(row);
  } catch (err) {
    console.error("Government registry create error:", err);
    return res.status(500).json({ message: "Failed to create government registry entry" });
  }
};

export const importGovernmentHospitalRegistry = async (req, res) => {
  try {
    const raw = String(req.body?.bulk || "").trim();
    if (!raw) return res.status(400).json({ message: "bulk payload is required" });

    let rows = [];
    if (raw.startsWith("[")) {
      rows = JSON.parse(raw);
    } else {
      rows = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [officialName, registrationNumber, hospitalType, country, region, city, validUntil] = line.split(",").map((v) => v.trim());
          return { officialName, registrationNumber, hospitalType, country, region, city, validUntil };
        });
    }

    const created = [];
    const skipped = [];
    for (const row of rows) {
      try {
        const entry = await GovernmentHospitalRegistry.create({
          officialName: String(row.officialName || "").trim(),
          registrationNumber: String(row.registrationNumber || "").trim().toUpperCase(),
          hospitalType: String(row.hospitalType || "PRIVATE").trim().toUpperCase(),
          location: {
            country: String(row.country || row.location?.country || "").trim(),
            region: String(row.region || row.location?.region || "").trim(),
            city: String(row.city || row.location?.city || "").trim(),
            address: String(row.address || row.location?.address || "").trim(),
          },
          status: "ACTIVE",
          validUntil: row.validUntil ? new Date(row.validUntil) : null,
        });
        created.push({ _id: entry._id, registrationNumber: entry.registrationNumber });
      } catch (err) {
        skipped.push({
          registrationNumber: row.registrationNumber || "",
          reason: err.message,
        });
      }
    }

    return res.json({ created, skipped });
  } catch (err) {
    console.error("Government registry import error:", err);
    return res.status(500).json({ message: "Failed to import government registry" });
  }
};

export const getHospitalVerificationReviewQueue = async (_req, res) => {
  try {
    const [hospitals, branches] = await Promise.all([
      Hospital.find({ "verification.status": "REVIEW_REQUIRED" })
        .select("name code location verification verificationDocuments createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Branch.find({ "verification.status": "REVIEW_REQUIRED" })
        .select("name parentHospitalName location verification createdAt hospital")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return res.json({ hospitals, branches });
  } catch (err) {
    console.error("Verification review queue error:", err);
    return res.status(500).json({ message: "Failed to load review queue" });
  }
};

export const reviewHospitalVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const decision = String(req.body?.decision || "").trim().toUpperCase();
    const reviewNotes = String(req.body?.reviewNotes || "").trim();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ message: "decision must be APPROVE or REJECT" });
    }
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    hospital.verification.status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    hospital.verification.reviewNotes = reviewNotes;
    hospital.verification.publicVisible = decision === "APPROVE";
    hospital.verification.verifiedAt = decision === "APPROVE" ? new Date() : null;
    hospital.verification.verifiedBy = decision === "APPROVE" ? req.user?._id || null : null;
    hospital.verification.approvalDate = decision === "APPROVE" ? new Date() : null;
    await hospital.save();

    if (hospital.admins?.length) {
      await Notification.insertMany(
        hospital.admins.map((adminId) => ({
          title: decision === "APPROVE" ? "Hospital Verified" : "Hospital Verification Rejected",
          body:
            decision === "APPROVE"
              ? `${hospital.name} is now government approved on AfyaLink.`
              : `${hospital.name} verification was rejected. Review notes were attached.`,
          category: "SYSTEM",
          user: adminId,
          hospital: hospital._id,
          meta: {
            type: "HOSPITAL_REVIEW_DECISION",
            decision,
          },
        }))
      );
    }

    return res.json({ success: true, hospital });
  } catch (err) {
    console.error("Hospital review error:", err);
    return res.status(500).json({ message: "Failed to review hospital verification" });
  }
};

export const streamHospitalVerificationDocument = async (req, res) => {
  try {
    const { id, documentType } = req.params;
    const hospital = await Hospital.findById(id).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    const doc = hospital?.verificationDocuments?.[documentType];
    if (!doc?.storagePath) return res.status(404).json({ message: "Document not found" });
    await fs.access(doc.storagePath);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName || `${documentType}.bin`}"`);
    return res.sendFile(doc.storagePath);
  } catch (err) {
    console.error("Hospital document stream error:", err);
    return res.status(500).json({ message: "Failed to open verification document" });
  }
};

export const getAdaptiveRiskPolicy = async (_req, res) => {
  try {
    const policy = await getRiskPolicy();
    res.json({ success: true, policy });
  } catch (err) {
    console.error("Risk policy read error:", err);
    res.status(500).json({ message: "Failed to load risk policy" });
  }
};

export const updateAdaptiveRiskPolicy = async (req, res) => {
  try {
    const updated = await upsertRiskPolicy(req.body || {}, req.user?._id || null);
    res.json({ success: true, policy: updated });
  } catch (err) {
    console.error("Risk policy update error:", err);
    res.status(500).json({ message: "Failed to update risk policy" });
  }
};

export const getAbacPolicies = async (req, res) => {
  try {
    const domain = String(req.query?.domain || "").trim();
    const resource = String(req.query?.resource || "").trim();
    const action = String(req.query?.action || "").trim();
    const activeOnly = req.query?.activeOnly === "1" || req.query?.activeOnly === "true";

    const filter = {};
    if (domain) filter.domain = domain;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (activeOnly) filter.active = true;

    const items = await AbacPolicy.find(filter)
      .sort({ domain: 1, resource: 1, action: 1, priority: 1, createdAt: 1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("ABAC policy read error:", err);
    return res.status(500).json({ message: "Failed to load ABAC policies" });
  }
};

export const upsertAbacPolicy = async (req, res) => {
  try {
    const id = req.params?.id || null;
    const domain = String(req.body?.domain || "").trim().toUpperCase();
    const resource = String(req.body?.resource || "").trim();
    const action = String(req.body?.action || "").trim();
    const effect = String(req.body?.effect || "ALLOW").trim().toUpperCase();
    const roles = Array.isArray(req.body?.roles)
      ? req.body.roles.map((r) => String(r).trim().toUpperCase()).filter(Boolean)
      : [];
    const priority = Number(req.body?.priority ?? 100);
    const active = req.body?.active !== false;
    const conditions = {
      requireActiveConsent: req.body?.conditions?.requireActiveConsent === true,
      requireSameHospitalOrPrivileged:
        req.body?.conditions?.requireSameHospitalOrPrivileged === true,
      requiredScopes: Array.isArray(req.body?.conditions?.requiredScopes)
        ? req.body.conditions.requiredScopes.map((s) => String(s).toLowerCase()).filter(Boolean)
        : [],
    };

    if (!domain || !resource || !action) {
      return res.status(400).json({ message: "domain, resource and action are required" });
    }
    if (!["ALLOW", "DENY"].includes(effect)) {
      return res.status(400).json({ message: "effect must be ALLOW or DENY" });
    }
    if (!Number.isFinite(priority) || priority < 1 || priority > 10000) {
      return res.status(400).json({ message: "priority must be between 1 and 10000" });
    }

    const update = {
      domain,
      resource,
      action,
      effect,
      roles,
      priority,
      active,
      conditions,
      updatedBy: req.user?._id || null,
    };

    const row = id
      ? await AbacPolicy.findOneAndUpdate({ _id: id }, update, { new: true })
      : await AbacPolicy.create(update);
    if (!row) return res.status(404).json({ message: "ABAC policy not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_UPSERTED",
      resource: "abac_policy",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        domain: row.domain,
        resource: row.resource,
        actionType: row.action,
        effect: row.effect,
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json(row);
  } catch (err) {
    console.error("ABAC policy upsert error:", err);
    return res.status(500).json({ message: "Failed to save ABAC policy" });
  }
};

export const deleteAbacPolicy = async (req, res) => {
  try {
    const row = await AbacPolicy.findByIdAndDelete(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC policy not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_DELETED",
      resource: "abac_policy",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: { domain: row.domain, resource: row.resource, actionType: row.action },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({ ok: true, id: row._id });
  } catch (err) {
    console.error("ABAC policy delete error:", err);
    return res.status(500).json({ message: "Failed to delete ABAC policy" });
  }
};

export const simulateAbacPolicy = async (req, res) => {
  try {
    const domain = String(req.body?.domain || "").trim().toUpperCase();
    const resource = String(req.body?.resource || "").trim();
    const action = String(req.body?.action || "").trim();
    const role = String(req.body?.role || "").trim().toUpperCase();

    if (!domain || !resource || !action || !role) {
      return res.status(400).json({
        message: "domain, resource, action and role are required",
      });
    }

    const sameHospital = req.body?.sameHospital === true;
    const hasActiveConsent = req.body?.hasActiveConsent === true;
    const sourceHospitalBypass = req.body?.sourceHospitalBypass === true;
    const allowedScopes = Array.isArray(req.body?.allowedScopes)
      ? req.body.allowedScopes.map((s) => String(s).toLowerCase())
      : [];

    const result = await evaluateAbac({
      domain,
      resource,
      action,
      includeTrace: true,
      fallbackAllow: false,
      req: {
        user: { role },
        resource: {
          sameHospital,
          hasActiveConsent,
          sourceHospitalBypass,
          allowedScopes,
        },
      },
    });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_POLICY_SIMULATED",
      resource: "abac_policy",
      resourceId: null,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        input: { domain, resource, action, role, sameHospital, hasActiveConsent, sourceHospitalBypass, allowedScopes },
        decision: { allowed: result.allowed, reason: result.reason },
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      ok: true,
      input: { domain, resource, action, role, sameHospital, hasActiveConsent, sourceHospitalBypass, allowedScopes },
      decision: {
        allowed: result.allowed,
        reason: result.reason,
      },
      matchedPolicy: result.matchedPolicy || null,
      trace: Array.isArray(result.trace) ? result.trace : [],
    });
  } catch (err) {
    console.error("ABAC policy simulate error:", err);
    return res.status(500).json({ message: "Failed to simulate ABAC policy" });
  }
};

function toSimulationPayload(input = {}) {
  return {
    domain: String(input.domain || "").trim().toUpperCase(),
    resource: String(input.resource || "").trim(),
    action: String(input.action || "").trim(),
    role: String(input.role || "").trim().toUpperCase(),
    sameHospital: input.sameHospital === true,
    hasActiveConsent: input.hasActiveConsent === true,
    sourceHospitalBypass: input.sourceHospitalBypass === true,
    allowedScopes: Array.isArray(input.allowedScopes)
      ? input.allowedScopes.map((s) => String(s).toLowerCase())
      : [],
  };
}

async function runAbacSimulationInput(input) {
  return evaluateAbac({
    domain: input.domain,
    resource: input.resource,
    action: input.action,
    includeTrace: true,
    fallbackAllow: false,
    req: {
      user: { role: input.role },
      resource: {
        sameHospital: input.sameHospital,
        hasActiveConsent: input.hasActiveConsent,
        sourceHospitalBypass: input.sourceHospitalBypass,
        allowedScopes: input.allowedScopes,
      },
    },
  });
}

export const getAbacTestCases = async (req, res) => {
  try {
    const activeOnly = req.query?.activeOnly === "1" || req.query?.activeOnly === "true";
    const filter = activeOnly ? { active: true } : {};
    const items = await AbacPolicyTestCase.find(filter).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("ABAC test case read error:", err);
    return res.status(500).json({ message: "Failed to load ABAC test cases" });
  }
};

export const upsertAbacTestCase = async (req, res) => {
  try {
    const id = req.params?.id || null;
    const name = String(req.body?.name || "").trim();
    const input = toSimulationPayload(req.body?.input || {});
    const expectedAllowed =
      typeof req.body?.expected?.allowed === "boolean" ? req.body.expected.allowed : null;
    const expectedReason = String(req.body?.expected?.reason || "").trim();
    const active = req.body?.active !== false;

    if (!name || !input.domain || !input.resource || !input.action || !input.role) {
      return res.status(400).json({ message: "name and valid input are required" });
    }

    const update = {
      name,
      input,
      expected: { allowed: expectedAllowed, reason: expectedReason },
      active,
      updatedBy: req.user?._id || null,
      ...(id ? {} : { createdBy: req.user?._id || null }),
    };

    const row = id
      ? await AbacPolicyTestCase.findOneAndUpdate({ _id: id }, update, { new: true })
      : await AbacPolicyTestCase.create(update);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "ABAC_TESTCASE_UPSERTED",
      resource: "abac_policy_test_case",
      resourceId: row._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: { name: row.name, input: row.input, expected: row.expected, active: row.active },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json(row);
  } catch (err) {
    console.error("ABAC test case upsert error:", err);
    return res.status(500).json({ message: "Failed to save ABAC test case" });
  }
};

export const deleteAbacTestCase = async (req, res) => {
  try {
    const row = await AbacPolicyTestCase.findByIdAndDelete(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });
    return res.json({ ok: true, id: row._id });
  } catch (err) {
    console.error("ABAC test case delete error:", err);
    return res.status(500).json({ message: "Failed to delete ABAC test case" });
  }
};

export const runAbacTestCase = async (req, res) => {
  try {
    const row = await AbacPolicyTestCase.findById(req.params?.id);
    if (!row) return res.status(404).json({ message: "ABAC test case not found" });

    const result = await runAbacSimulationInput(row.input);
    const expectedAllowed = row.expected?.allowed;
    const expectedReason = String(row.expected?.reason || "");
    const passed =
      expectedAllowed === null
        ? true
        : result.allowed === expectedAllowed &&
          (!expectedReason || expectedReason === String(result.reason || ""));

    row.lastRunAt = new Date();
    row.lastRun = {
      passed,
      allowed: result.allowed,
      reason: result.reason || "",
      matchedPolicyId: result?.matchedPolicy?._id || null,
    };
    await row.save();

    return res.json({
      id: row._id,
      name: row.name,
      passed,
      expected: row.expected,
      decision: { allowed: result.allowed, reason: result.reason },
      matchedPolicy: result.matchedPolicy || null,
      trace: Array.isArray(result.trace) ? result.trace : [],
      lastRunAt: row.lastRunAt,
    });
  } catch (err) {
    console.error("ABAC test case run error:", err);
    return res.status(500).json({ message: "Failed to run ABAC test case" });
  }
};

export const runAllAbacTestCases = async (_req, res) => {
  try {
    const rows = await AbacPolicyTestCase.find({ active: true });
    let passed = 0;
    let failed = 0;
    const results = [];

    for (const row of rows) {
      const result = await runAbacSimulationInput(row.input);
      const expectedAllowed = row.expected?.allowed;
      const expectedReason = String(row.expected?.reason || "");
      const ok =
        expectedAllowed === null
          ? true
          : result.allowed === expectedAllowed &&
            (!expectedReason || expectedReason === String(result.reason || ""));
      if (ok) passed += 1;
      else failed += 1;

      row.lastRunAt = new Date();
      row.lastRun = {
        passed: ok,
        allowed: result.allowed,
        reason: result.reason || "",
        matchedPolicyId: result?.matchedPolicy?._id || null,
      };
      await row.save();

      results.push({
        id: row._id,
        name: row.name,
        passed: ok,
        expected: row.expected,
        decision: { allowed: result.allowed, reason: result.reason },
      });
    }

    return res.json({
      ok: true,
      totals: { active: rows.length, passed, failed },
      results,
    });
  } catch (err) {
    console.error("ABAC test case run-all error:", err);
    return res.status(500).json({ message: "Failed to run ABAC test cases" });
  }
};
