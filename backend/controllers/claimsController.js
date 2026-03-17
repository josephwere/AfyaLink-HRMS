import Claim from "../models/Claim.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import FraudAlert from "../models/FraudAlert.js";
import ClaimAuditLog from "../models/ClaimAuditLog.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { appendClaimAudit } from "../services/claimAuditService.js";
import { evaluateClaim } from "../services/claimFraudEngine.js";
import { decrypt } from "../services/cryptoService.js";
import { stableStringify, verifySignature } from "../utils/claimSignature.js";

function resolveHospitalId(req) {
  return req.user?.hospitalId || req.user?.hospital || req.body?.hospitalId || null;
}

export const submitClaim = async (req, res, next) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return res.status(400).json({ message: "Hospital is required" });

    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    const patient = await Patient.findById(req.body?.patientId).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    if (String(patient.hospital) !== String(hospitalId)) {
      return res.status(403).json({ message: "Patient is not linked to this hospital" });
    }

    const requireSignature =
      hospital?.claimsSecurity?.requireSignature !== false &&
      process.env.CLAIM_SIGNATURE_REQUIRED !== "0";

    if (requireSignature) {
      const keyId = req.header("x-claim-key-id") || "";
      if (!hospital?.claimsSecurity?.hmacSecretEnc) {
        return res.status(400).json({ message: "Hospital claim secret not configured" });
      }
      if (keyId && hospital.claimsSecurity?.keyId && keyId !== hospital.claimsSecurity.keyId) {
        return res.status(403).json({ message: "Invalid claim key id" });
      }
      const masterKey = process.env.CLAIM_SECRET_KEY;
      if (!masterKey) {
        return res.status(500).json({ message: "CLAIM_SECRET_KEY not configured" });
      }
      const payload = stableStringify(req.body || {});
      const signature = req.header("x-claim-signature") || "";
      const secret = decrypt(hospital.claimsSecurity.hmacSecretEnc, masterKey);
      const valid = verifySignature({ secret, payload, signature });
      if (!valid) {
        return res.status(403).json({ message: "Invalid claim signature" });
      }
    }

    const now = new Date();
    const safeDate = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };
    const servicePeriod = req.body?.servicePeriod || {};
    const normalizedServicePeriod = {
      start: safeDate(servicePeriod?.start, now),
      end: safeDate(servicePeriod?.end, safeDate(servicePeriod?.start, now)),
    };

    const claim = new Claim({
      hospital: hospitalId,
      patient: patient._id,
      encounter: req.body?.encounterId || null,
      provider: req.body?.provider || {},
      country: req.body?.country || hospital?.location?.country || "",
      currency: req.body?.currency || "KES",
      totalAmount: Number(req.body?.totalAmount || 0),
      servicePeriod: normalizedServicePeriod,
      procedures: Array.isArray(req.body?.procedures) ? req.body.procedures : [],
      submissionChannel: "API",
      submittedBy: req.user?._id || null,
      signature: {
        algorithm: "HMAC-SHA256",
        value: req.header("x-claim-signature") || "",
        keyId: req.header("x-claim-key-id") || hospital?.claimsSecurity?.keyId || "",
        signedAt: new Date(),
      },
      patientSnapshot: {
        nationalId: patient.nationalId || "",
        countryId: patient.countryId || "",
        dob: patient.dob || null,
        gender: patient.gender || "",
        registryMatch: null,
        identityStatus: patient?.identityVerification?.status || "",
      },
      hospitalSnapshot: {
        name: hospital.name || "",
        registrationNumber: hospital?.verification?.registrationNumber || "",
        verificationStatus: hospital?.verification?.status || "",
      },
    });

    const evaluation = await evaluateClaim({ claim, hospital, patient });
    claim.riskScore = evaluation.riskScore;
    claim.riskSignals = evaluation.signals;
    claim.riskFlags = [...new Set(evaluation.signals.map((s) => s.code))];
    claim.duplicateGroup = evaluation.duplicateGroupSeed || "";
    if (evaluation.duplicateOf) {
      claim.duplicateOf = evaluation.duplicateOf;
    }
    if (evaluation.statusOverride) {
      claim.status = evaluation.statusOverride;
    }
    if (evaluation.registryMatch !== undefined) {
      claim.patientSnapshot.registryMatch = evaluation.registryMatch;
      const method = patient?.nationalId ? "NATIONAL_ID" : patient?.countryId ? "HEALTH_ID" : "";
      await Patient.updateOne(
        { _id: patient._id },
        {
          $set: {
            "identityVerification.registryMatch": evaluation.registryMatch,
            "identityVerification.lastCheckedAt": now,
            "identityVerification.method": method,
          },
        }
      );
      if (evaluation.registryMatch) {
        await Patient.updateOne(
          { _id: patient._id },
          {
            $set: {
              "identityVerification.status": "VERIFIED",
              "identityVerification.verifiedAt": now,
              "identityVerification.immutable": true,
            },
          }
        );
        claim.patientSnapshot.identityStatus = "VERIFIED";
      } else {
        await Patient.updateOne(
          { _id: patient._id, "identityVerification.status": { $ne: "VERIFIED" } },
          { $set: { "identityVerification.status": "UNVERIFIED" } }
        );
        claim.patientSnapshot.identityStatus = patient?.identityVerification?.status || "UNVERIFIED";
      }
    }

    await claim.save();

    if (evaluation.signals.length > 0) {
      const severity = evaluation.signals.some((s) => s.severity === "HIGH")
        ? "HIGH"
        : evaluation.signals.some((s) => s.severity === "MEDIUM")
          ? "MEDIUM"
          : "LOW";
      const alert = await FraudAlert.create({
        claim: claim._id,
        hospital: hospitalId,
        patient: patient._id,
        severity,
        signals: evaluation.signals.map((s) => s.code),
      });

      if (severity === "HIGH") {
        const governmentUsers = await User.find({
          role: { $in: ["GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR"] },
          active: { $ne: false },
        })
          .select("_id")
          .lean();
        if (governmentUsers.length) {
          await Notification.insertMany(
            governmentUsers.map((u) => ({
              user: u._id,
              category: "REGULATORY",
              title: "High-risk claim detected",
              body: `${hospital.name} submitted a high-risk claim for ${patient.firstName} ${patient.lastName}.`,
              meta: { claimId: claim._id, alertId: alert._id, severity },
            }))
          );
        }
      }
    }

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_SUBMITTED",
      payload: {
        status: claim.status,
        riskScore: claim.riskScore,
        riskFlags: claim.riskFlags,
      },
      actorId: req.user?._id,
    });

    return res.status(201).json({ claim, risk: evaluation });
  } catch (err) {
    next(err);
  }
};

export const listClaims = async (req, res, next) => {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const filter = {};
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role)) {
      filter.hospital = hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.provider) filter["provider.code"] = String(req.query.provider).toUpperCase();
    if (req.query.patientId) filter.patient = req.query.patientId;

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const items = await Claim.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName gender nationalId");
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName gender nationalId")
      .populate("submittedBy", "name email role");
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const privilegedRoles = [
      "SUPER_ADMIN",
      "SYSTEM_ADMIN",
      "DEVELOPER",
      "GOVERNMENT_ADMIN",
      "GOVERNMENT_REGULATOR",
      "GOVERNMENT_AUDITOR",
      "GOVERNMENT_INSPECTOR",
      "GOVERNMENT_ANALYST",
    ];
    if (!privilegedRoles.includes(role) && String(claim.hospital?._id) !== String(hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ claim });
  } catch (err) {
    next(err);
  }
};

export const listClaimAuditLogs = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .select("_id hospital")
      .lean();
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const privilegedRoles = [
      "SUPER_ADMIN",
      "SYSTEM_ADMIN",
      "DEVELOPER",
      "GOVERNMENT_ADMIN",
      "GOVERNMENT_REGULATOR",
      "GOVERNMENT_AUDITOR",
      "GOVERNMENT_INSPECTOR",
      "GOVERNMENT_ANALYST",
    ];
    if (!privilegedRoles.includes(role) && String(claim.hospital) !== String(hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const items = await ClaimAuditLog.find({ claim: claim._id })
      .sort({ sequence: 1 })
      .limit(500)
      .lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const reviewClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    const decision = String(req.body?.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }
    claim.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    claim.decision = {
      reviewedBy: req.user?._id || null,
      reviewedAt: new Date(),
      notes: String(req.body?.notes || "").trim(),
    };
    await claim.save();

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_REVIEWED",
      payload: { status: claim.status, notes: claim.decision.notes || "" },
      actorId: req.user?._id,
    });

    await FraudAlert.updateMany(
      { claim: claim._id, status: { $in: ["OPEN", "REVIEWING"] } },
      { $set: { status: "RESOLVED", resolvedBy: req.user?._id || null, resolvedAt: new Date() } }
    );

    return res.json({ claim });
  } catch (err) {
    next(err);
  }
};

export const listFraudAlerts = async (req, res, next) => {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const privilegedRoles = [
      "SUPER_ADMIN",
      "SYSTEM_ADMIN",
      "DEVELOPER",
      "GOVERNMENT_ADMIN",
      "GOVERNMENT_REGULATOR",
      "GOVERNMENT_AUDITOR",
      "GOVERNMENT_INSPECTOR",
      "GOVERNMENT_ANALYST",
    ];
    const filter = {};
    if (!privilegedRoles.includes(role)) {
      filter.hospital = hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.severity) filter.severity = String(req.query.severity).toUpperCase();

    const alerts = await FraudAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("claim", "status riskScore provider totalAmount createdAt")
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName nationalId");
    return res.json({ items: alerts });
  } catch (err) {
    next(err);
  }
};

export const getFraudSummary = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalClaims = await Claim.countDocuments({ createdAt: { $gte: since } });
    const reviewClaims = await Claim.countDocuments({ createdAt: { $gte: since }, status: "REVIEW_REQUIRED" });
    const rejectedClaims = await Claim.countDocuments({ createdAt: { $gte: since }, status: "REJECTED" });
    const openAlerts = await FraudAlert.countDocuments({ status: "OPEN" });

    return res.json({
      totals: { totalClaims, reviewClaims, rejectedClaims, openAlerts },
    });
  } catch (err) {
    next(err);
  }
};

const parseDateRange = (req) => {
  const rawFrom = req.query?.from ? new Date(req.query.from) : null;
  const rawTo = req.query?.to ? new Date(req.query.to) : null;
  const now = new Date();
  const from = rawFrom && !Number.isNaN(rawFrom.getTime()) ? rawFrom : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = rawTo && !Number.isNaN(rawTo.getTime()) ? rawTo : now;
  if (from > to) return { from: to, to: from };
  return { from, to };
};

const buildClaimFilter = (req) => {
  const { from, to } = parseDateRange(req);
  const filter = {
    createdAt: { $gte: from, $lte: to },
  };
  if (req.query?.country) filter.country = String(req.query.country).trim();
  if (req.query?.provider) filter["provider.code"] = String(req.query.provider).toUpperCase();
  if (req.query?.status) filter.status = String(req.query.status).toUpperCase();
  if (req.query?.hospitalId) filter.hospital = req.query.hospitalId;
  return { filter, from, to };
};

const mapStatusCounts = (rows) => {
  const out = {
    SUBMITTED: 0,
    REVIEW_REQUIRED: 0,
    APPROVED: 0,
    REJECTED: 0,
    PAID: 0,
    VOID: 0,
  };
  for (const row of rows) {
    const key = String(row?._id || "").toUpperCase();
    if (!key) continue;
    out[key] = Number(row?.count || 0);
  }
  return out;
};

export const getGovernmentDashboard = async (req, res, next) => {
  try {
    const { filter, from, to } = buildClaimFilter(req);
    const statusAgg = await Claim.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, avgRisk: { $avg: "$riskScore" } } },
    ]);

    const statusCounts = mapStatusCounts(statusAgg);
    const totalClaims = Object.values(statusCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const totalAmount = statusAgg.reduce((sum, row) => sum + Number(row?.totalAmount || 0), 0);
    const avgRiskScore = statusAgg.length
      ? Math.round(statusAgg.reduce((sum, row) => sum + Number(row?.avgRisk || 0), 0) / statusAgg.length)
      : 0;

    const trends = await Claim.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    const trendMap = new Map();
    for (const row of trends) {
      const key = `${row._id.y}-${String(row._id.m).padStart(2, "0")}-${String(row._id.d).padStart(2, "0")}`;
      const entry = trendMap.get(key) || { date: key, submitted: 0, review: 0, approved: 0, rejected: 0, paid: 0 };
      const status = String(row?._id?.status || "").toUpperCase();
      if (status === "SUBMITTED") entry.submitted += row.count;
      if (status === "REVIEW_REQUIRED") entry.review += row.count;
      if (status === "APPROVED") entry.approved += row.count;
      if (status === "REJECTED") entry.rejected += row.count;
      if (status === "PAID") entry.paid += row.count;
      trendMap.set(key, entry);
    }

    const countryAgg = await Claim.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$country", "UNKNOWN"] }, totalClaims: { $sum: 1 }, rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } } } },
      { $sort: { totalClaims: -1 } },
      { $limit: 50 },
    ]);

    const providerAgg = await Claim.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$provider.code", "UNKNOWN"] }, totalClaims: { $sum: 1 }, rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } } } },
      { $sort: { totalClaims: -1 } },
      { $limit: 50 },
    ]);

    const currencyAgg = await Claim.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$currency", "UNKNOWN"] }, totalAmount: { $sum: "$totalAmount" }, totalClaims: { $sum: 1 } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 50 },
    ]);

    const alertsFilter = { status: "OPEN" };
    if (req.query?.hospitalId) alertsFilter.hospital = req.query.hospitalId;
    const alertRows = await FraudAlert.find(alertsFilter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("claim", "status riskScore totalAmount createdAt country provider riskFlags")
      .populate("hospital", "name code location")
      .populate("patient", "firstName lastName nationalId gender");

    const suspiciousClaims = alertRows
      .filter((row) => {
        if (!req.query?.country) return true;
        const country = String(req.query.country).trim();
        return row?.claim?.country === country || row?.hospital?.location?.country === country;
      })
      .map((row) => ({
        id: row._id,
        claimId: row?.claim?._id,
        severity: row?.severity,
        signals: row?.signals || [],
        status: row?.claim?.status || "—",
        riskScore: row?.claim?.riskScore || 0,
        riskFlags: row?.claim?.riskFlags || [],
        totalAmount: row?.claim?.totalAmount || 0,
        createdAt: row?.claim?.createdAt || row?.createdAt,
        hospital: row?.hospital ? { id: row.hospital._id, name: row.hospital.name, code: row.hospital.code, country: row?.hospital?.location?.country } : null,
        patient: row?.patient ? { id: row.patient._id, name: `${row.patient.firstName} ${row.patient.lastName}`, nationalId: row.patient.nationalId, gender: row.patient.gender } : null,
        provider: row?.claim?.provider || {},
      }));

    const hospitalAgg = await Claim.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$hospital",
          totalClaims: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
          reviewRequired: { $sum: { $cond: [{ $eq: ["$status", "REVIEW_REQUIRED"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "SUBMITTED"] }, 1, 0] } },
          avgRiskScore: { $avg: "$riskScore" },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      {
        $lookup: {
          from: "hospitals",
          localField: "_id",
          foreignField: "_id",
          as: "hospital",
        },
      },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      { $sort: { totalClaims: -1 } },
      { $limit: 200 },
    ]);

    const alertAgg = await FraudAlert.aggregate([
      { $match: alertsFilter },
      { $group: { _id: "$hospital", suspicious: { $sum: 1 }, high: { $sum: { $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0] } } } },
    ]);
    const alertByHospital = new Map(alertAgg.map((row) => [String(row._id), row]));

    const hospitalMonitoring = hospitalAgg.map((row) => {
      const alert = alertByHospital.get(String(row._id)) || { suspicious: 0, high: 0 };
      return {
        id: row._id,
        name: row?.hospital?.name || "Unknown",
        code: row?.hospital?.code || "",
        country: row?.hospital?.location?.country || "",
        totalClaims: row.totalClaims,
        approved: row.approved,
        rejected: row.rejected,
        reviewRequired: row.reviewRequired,
        pending: row.pending,
        rejectionRate: row.totalClaims ? Math.round((row.rejected / row.totalClaims) * 100) : 0,
        avgRiskScore: Math.round(row.avgRiskScore || 0),
        totalAmount: row.totalAmount || 0,
        suspicious: alert.suspicious || 0,
        highSeverity: alert.high || 0,
      };
    });

    return res.json({
      range: { from, to },
      summary: {
        totalClaims,
        approved: statusCounts.APPROVED,
        rejected: statusCounts.REJECTED,
        pending: statusCounts.SUBMITTED,
        reviewRequired: statusCounts.REVIEW_REQUIRED,
        paid: statusCounts.PAID,
        suspiciousClaims: suspiciousClaims.length,
        totalAmount,
        avgRiskScore,
      },
      trends: Array.from(trendMap.values()),
      suspiciousClaims,
      hospitalMonitoring,
      countrySummary: countryAgg.map((row) => ({
        country: row._id || "UNKNOWN",
        totalClaims: row.totalClaims,
        rejected: row.rejected,
      })),
      providerSummary: providerAgg.map((row) => ({
        provider: row._id || "UNKNOWN",
        totalClaims: row.totalClaims,
        rejected: row.rejected,
      })),
      currencySummary: currencyAgg.map((row) => ({
        currency: row._id || "UNKNOWN",
        totalAmount: row.totalAmount,
        totalClaims: row.totalClaims,
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getGovernmentPatientHistory = async (req, res, next) => {
  try {
    const q = String(req.query?.q || "").trim();
    if (!q) return res.status(400).json({ message: "Patient identifier is required" });

    const match = {};
    const or = [
      { nationalId: q },
      { countryId: q },
    ];
    if (q && /^[a-f0-9]{24}$/i.test(q)) {
      or.push({ _id: q });
    }
    match.$or = or;

    const patients = await Patient.find(match)
      .select("firstName lastName gender dob nationalId countryId identityVerification")
      .limit(5)
      .lean();

    if (!patients.length) {
      return res.json({ patient: null, claims: [], alerts: [], summary: { totalClaims: 0, suspicious: 0 } });
    }

    const patientIds = patients.map((p) => p._id);
    const claims = await Claim.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("hospital", "name code")
      .lean();

    const alerts = await FraudAlert.find({ patient: { $in: patientIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      patient: patients[0],
      linkedPatients: patients.slice(1),
      claims: claims.map((claim) => ({
        id: claim._id,
        hospital: claim?.hospital ? { id: claim.hospital._id, name: claim.hospital.name, code: claim.hospital.code } : null,
        status: claim.status,
        provider: claim.provider || {},
        totalAmount: claim.totalAmount,
        currency: claim.currency,
        riskScore: claim.riskScore,
        riskFlags: claim.riskFlags || [],
        servicePeriod: claim.servicePeriod,
        createdAt: claim.createdAt,
      })),
      alerts: alerts.map((alert) => ({
        id: alert._id,
        severity: alert.severity,
        signals: alert.signals || [],
        status: alert.status,
        createdAt: alert.createdAt,
      })),
      summary: {
        totalClaims: claims.length,
        suspicious: alerts.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const requestClaimVerification = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    claim.status = "REVIEW_REQUIRED";
    claim.metadata = {
      ...(claim.metadata || {}),
      verificationRequestedAt: new Date(),
      verificationNotes: String(req.body?.notes || "").trim(),
    };
    await claim.save();

    await FraudAlert.updateMany(
      { claim: claim._id, status: "OPEN" },
      { $set: { status: "REVIEWING" } }
    );

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_VERIFICATION_REQUESTED",
      payload: { notes: claim.metadata?.verificationNotes || "" },
      actorId: req.user?._id,
    });

    return res.json({ claim });
  } catch (err) {
    next(err);
  }
};

export const assignClaimAudit = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id).select("_id");
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    const assigneeRole = String(req.body?.role || "GOVERNMENT_AUDITOR").trim().toUpperCase();
    const assigneeId = req.body?.assigneeId || null;

    const alert = await FraudAlert.findOne({ claim: claim._id }).sort({ createdAt: -1 });
    if (!alert) return res.status(404).json({ message: "Fraud alert not found" });

    alert.status = "REVIEWING";
    alert.assignedRole = assigneeRole;
    alert.assignedTo = assigneeId || null;
    alert.assignedAt = new Date();
    await alert.save();

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_ASSIGNED_FOR_AUDIT",
      payload: { role: assigneeRole, assigneeId: assigneeId || null },
      actorId: req.user?._id,
    });

    if (assigneeId) {
      await Notification.create({
        user: assigneeId,
        category: "REGULATORY",
        title: "Claim assigned for audit",
        body: "A claim has been assigned to you for manual audit.",
        meta: { claimId: claim._id, alertId: alert._id },
      });
    }

    return res.json({ alert });
  } catch (err) {
    next(err);
  }
};

export const addFraudFeedback = async (req, res, next) => {
  try {
    const alert = await FraudAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: "Fraud alert not found" });
    const label = String(req.body?.label || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!label) return res.status(400).json({ message: "Feedback label is required" });

    alert.feedback = [
      ...(alert.feedback || []),
      {
        label,
        notes,
        actor: req.user?._id || null,
        createdAt: new Date(),
      },
    ];
    await alert.save();

    await appendClaimAudit({
      claimId: alert.claim,
      event: "FRAUD_FEEDBACK_ADDED",
      payload: { label, notes },
      actorId: req.user?._id,
    });

    return res.json({ alert });
  } catch (err) {
    next(err);
  }
};
