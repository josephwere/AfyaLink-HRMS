import Claim from "../models/Claim.js";
import FraudAlert from "../models/FraudAlert.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import ComplianceLedger from "../models/ComplianceLedger.js";
import { notify } from "../services/notificationService.js";
import ClaimAuditLog from "../models/ClaimAuditLog.js";
import AuditLog from "../models/AuditLog.js";
import HealthFund from "../models/HealthFund.js";
import HospitalLicense from "../models/HospitalLicense.js";
import HospitalInspection from "../models/HospitalInspection.js";
import EnforcementAction from "../models/EnforcementAction.js";
import Notification from "../models/Notification.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
  const filter = { createdAt: { $gte: from, $lte: to } };
  if (req.query?.country) filter.country = String(req.query.country).trim().toUpperCase();
  if (req.query?.provider) filter["provider.code"] = String(req.query.provider).trim().toUpperCase();
  return { filter, from, to };
};

const computeCompliance = ({
  hospital,
  license,
  inspection,
  enforcementOpen,
  claimStats,
  fraudHigh,
}) => {
  let score = 100;
  const verificationStatus = hospital?.verification?.status || "UNVERIFIED";
  if (verificationStatus !== "VERIFIED") score -= 30;
  if (!license || license.status !== "ACTIVE") score -= 25;
  if (license?.status === "SUSPENDED" || license?.status === "REVOKED") score -= 30;
  if (enforcementOpen > 0) score -= 20;
  if (inspection?.complianceScore) score = Math.min(score, Number(inspection.complianceScore || 0));

  const rejectionRate = claimStats?.total
    ? Number(claimStats.rejected || 0) / Number(claimStats.total || 1)
    : 0;
  if (rejectionRate > 0.2) score -= 10;
  if (fraudHigh > 0) score -= 10;

  score = clamp(score, 0, 100);
  const status = score >= 80 && enforcementOpen === 0 ? "COMPLIANT" : "NON_COMPLIANT";
  return { score, status, rejectionRate };
};

export const getGovernmentOverview = async (req, res, next) => {
  try {
    const { filter, from, to } = buildClaimFilter(req);
    const countryFilter = req.query?.country ? String(req.query.country).trim().toUpperCase() : null;

    const [
      claimStatusAgg,
      claimsByCountryAgg,
      fraudByCountryAgg,
      fraudSeverityAgg,
      hospitals,
      patientsTotal,
      patientsVerified,
      funds,
      providerSummaryAgg,
      currencySummaryAgg,
      procedureAgg,
      fraudSignalAgg,
      suspiciousAlerts,
    ] = await Promise.all([
      Claim.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
            avgRisk: { $avg: "$riskScore" },
          },
        },
      ]),
      Claim.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$country", "UNKNOWN"] },
            totalClaims: { $sum: 1 },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
            avgRisk: { $avg: "$riskScore" },
          },
        },
      ]),
      FraudAlert.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $lookup: {
            from: "claims",
            localField: "claim",
            foreignField: "_id",
            as: "claim",
          },
        },
        { $unwind: { path: "$claim", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$claim.country", "UNKNOWN"] },
            fraudCount: { $sum: 1 },
            high: { $sum: { $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0] } },
          },
        },
      ]),
      FraudAlert.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      Hospital.find(countryFilter ? { "location.country": countryFilter } : {})
        .select("name code location verification accreditations active")
        .lean(),
      Patient.countDocuments(countryFilter ? { "location.country": countryFilter } : {}),
      Patient.countDocuments({
        ...(countryFilter ? { "location.country": countryFilter } : {}),
        "identityVerification.status": "VERIFIED",
      }),
      HealthFund.find(countryFilter ? { country: countryFilter } : {})
        .sort({ country: 1, code: 1 })
        .lean(),
      Claim.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$provider.code", "UNKNOWN"] },
            totalClaims: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
          },
        },
        { $sort: { totalClaims: -1 } },
      ]),
      Claim.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ["$currency", "UNKNOWN"] },
            totalClaims: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      Claim.aggregate([
        { $match: filter },
        { $unwind: { path: "$procedures", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { $ifNull: ["$procedures.code", "UNKNOWN"] },
            name: { $first: "$procedures.name" },
            totalClaims: { $sum: 1 },
            totalAmount: { $sum: "$procedures.amount" },
          },
        },
        { $sort: { totalClaims: -1 } },
        { $limit: 15 },
      ]),
      FraudAlert.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $unwind: { path: "$signals", preserveNullAndEmptyArrays: false } },
        { $group: { _id: "$signals", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      FraudAlert.find({ createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .limit(15)
        .populate("claim", "status riskScore provider totalAmount createdAt")
        .populate("hospital", "name code location")
        .populate("patient", "firstName lastName nationalId gender")
        .lean(),
    ]);

    const statusCounts = claimStatusAgg.reduce(
      (acc, row) => {
        const key = String(row._id || "").toUpperCase();
        acc[key] = Number(row.count || 0);
        acc.amounts[key] = Number(row.totalAmount || 0);
        return acc;
      },
      { amounts: {} }
    );

    const totalClaims = Object.entries(statusCounts).reduce((sum, [key, val]) => {
      if (key === "amounts") return sum;
      return sum + Number(val || 0);
    }, 0);

    const totalAmount = Object.values(statusCounts.amounts || {}).reduce((sum, val) => sum + Number(val || 0), 0);

    const fraudSeverity = fraudSeverityAgg.reduce((acc, row) => {
      acc[String(row._id || "UNKNOWN")] = Number(row.count || 0);
      return acc;
    }, {});

    const providerSummary = providerSummaryAgg.map((row) => ({
      provider: row._id || "UNKNOWN",
      totalClaims: row.totalClaims || 0,
      rejected: row.rejected || 0,
      totalAmount: row.totalAmount || 0,
    }));

    const currencySummary = currencySummaryAgg.map((row) => ({
      currency: row._id || "UNKNOWN",
      totalClaims: row.totalClaims || 0,
      totalAmount: row.totalAmount || 0,
    }));

    const proceduresSummary = procedureAgg.map((row) => ({
      code: row._id || "UNKNOWN",
      name: row.name || "",
      totalClaims: row.totalClaims || 0,
      totalAmount: row.totalAmount || 0,
    }));

    const fraudSignals = fraudSignalAgg.map((row) => ({
      signal: row._id || "UNKNOWN",
      count: row.count || 0,
    }));

    const suspiciousClaims = suspiciousAlerts.map((alert) => ({
      id: alert._id,
      claimId: alert.claim?._id || alert.claim,
      severity: alert.severity,
      status: alert.status,
      signals: alert.signals || [],
      hospital: alert.hospital,
      patient: alert.patient,
      riskScore: alert.claim?.riskScore || 0,
      totalAmount: alert.claim?.totalAmount || 0,
      provider: alert.claim?.provider || {},
      createdAt: alert.createdAt,
    }));

    const hospitalIds = hospitals.map((row) => row._id);
    const [licenses, inspectionsAgg, enforcementAgg, claimHospitalAgg, fraudHospitalAgg] = await Promise.all([
      HospitalLicense.find({ hospital: { $in: hospitalIds } })
        .sort({ expiresAt: -1, createdAt: -1 })
        .lean(),
      HospitalInspection.aggregate([
        { $match: { hospital: { $in: hospitalIds } } },
        { $sort: { performedAt: -1, scheduledAt: -1, createdAt: -1 } },
        { $group: { _id: "$hospital", record: { $first: "$$ROOT" } } },
      ]),
      EnforcementAction.aggregate([
        { $match: { hospital: { $in: hospitalIds }, status: "OPEN" } },
        { $group: { _id: "$hospital", open: { $sum: 1 }, types: { $addToSet: "$actionType" } } },
      ]),
      Claim.aggregate([
        { $match: { ...filter, hospital: { $in: hospitalIds } } },
        {
          $group: {
            _id: "$hospital",
            total: { $sum: 1 },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ["$status", "REVIEW_REQUIRED"] }, 1, 0] } },
            totalAmount: { $sum: "$totalAmount" },
            avgRisk: { $avg: "$riskScore" },
          },
        },
      ]),
      FraudAlert.aggregate([
        { $match: { hospital: { $in: hospitalIds }, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$hospital", high: { $sum: { $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0] } }, total: { $sum: 1 } } },
      ]),
    ]);

    const licenseMap = new Map();
    for (const lic of licenses) {
      const key = String(lic.hospital);
      if (!licenseMap.has(key)) licenseMap.set(key, lic);
    }
    const inspectionMap = new Map(inspectionsAgg.map((row) => [String(row._id), row.record]));
    const enforcementMap = new Map(enforcementAgg.map((row) => [String(row._id), row]));
    const claimMap = new Map(claimHospitalAgg.map((row) => [String(row._id), row]));
    const fraudMap = new Map(fraudHospitalAgg.map((row) => [String(row._id), row]));

    let compliantCount = 0;
    let nonCompliantCount = 0;
    const hospitalMonitoring = hospitals.map((hospital) => {
      const license = licenseMap.get(String(hospital._id)) || null;
      const inspection = inspectionMap.get(String(hospital._id)) || null;
      const enforcement = enforcementMap.get(String(hospital._id)) || { open: 0 };
      const claimStats = claimMap.get(String(hospital._id)) || { total: 0, rejected: 0, approved: 0, review: 0 };
      const fraudStats = fraudMap.get(String(hospital._id)) || { high: 0, total: 0 };
      const compliance = computeCompliance({
        hospital,
        license,
        inspection,
        enforcementOpen: enforcement.open || 0,
        claimStats,
        fraudHigh: fraudStats.high || 0,
      });
      if (compliance.status === "COMPLIANT") compliantCount += 1;
      else nonCompliantCount += 1;
      return {
        id: hospital._id,
        name: hospital.name,
        code: hospital.code,
        country: hospital?.location?.country || "",
        region: hospital?.location?.region || "",
        verificationStatus: hospital?.verification?.status || "UNVERIFIED",
        licenseStatus: license?.status || "PENDING",
        licenseExpiresAt: license?.expiresAt || null,
        inspectionStatus: inspection?.status || "NONE",
        inspectionScore: inspection?.complianceScore || 0,
        enforcementOpen: enforcement?.open || 0,
        totalClaims: claimStats?.total || 0,
        rejectedClaims: claimStats?.rejected || 0,
        approvedClaims: claimStats?.approved || 0,
        reviewClaims: claimStats?.review || 0,
        avgRiskScore: Math.round(claimStats?.avgRisk || 0),
        complianceScore: compliance.score,
        complianceStatus: compliance.status,
        rejectionRate: Math.round((compliance.rejectionRate || 0) * 100),
        fraudHigh: fraudStats.high || 0,
      };
    });

    const riskMap = claimsByCountryAgg.map((row) => {
      const fraud = fraudByCountryAgg.find((f) => f._id === row._id) || { fraudCount: 0, high: 0 };
      const totalClaimsCountry = Number(row.totalClaims || 0);
      const riskRatio = totalClaimsCountry ? fraud.fraudCount / totalClaimsCountry : 0;
      return {
        country: row._id || "UNKNOWN",
        totalClaims: totalClaimsCountry,
        rejected: row.rejected || 0,
        fraudCount: fraud.fraudCount || 0,
        highSeverity: fraud.high || 0,
        avgRisk: Math.round(row.avgRisk || 0),
        riskScore: clamp(Math.round(riskRatio * 100), 0, 100),
      };
    });

    const trendsAgg = await Claim.aggregate([
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
          amount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    const trendMap = new Map();
    for (const row of trendsAgg) {
      const dateKey = `${row._id.y}-${String(row._id.m).padStart(2, "0")}-${String(row._id.d).padStart(2, "0")}`;
      const entry = trendMap.get(dateKey) || {
        date: dateKey,
        submitted: 0,
        review: 0,
        approved: 0,
        rejected: 0,
        paid: 0,
        total: 0,
      };
      const status = String(row._id.status || "").toUpperCase();
      entry.total += row.count;
      if (status === "SUBMITTED") entry.submitted += row.count;
      if (status === "REVIEW_REQUIRED") entry.review += row.count;
      if (status === "APPROVED") entry.approved += row.count;
      if (status === "REJECTED") entry.rejected += row.count;
      if (status === "PAID") entry.paid += row.count;
      trendMap.set(dateKey, entry);
    }

    const notifications = await Notification.find({ user: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      range: { from, to },
      summary: {
        totalClaims,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
        pending: statusCounts.SUBMITTED || 0,
        reviewRequired: statusCounts.REVIEW_REQUIRED || 0,
        paid: statusCounts.PAID || 0,
        fraudOpen: fraudSeverity.OPEN || 0,
        fraudHigh: fraudSeverity.HIGH || 0,
        hospitalsTotal: hospitals.length,
        patientsTotal,
        patientsVerified,
        patientsUnverified: Math.max(0, patientsTotal - patientsVerified),
        compliantHospitals: compliantCount,
        nonCompliantHospitals: nonCompliantCount,
        totalAmount,
        approvedAmount: statusCounts.amounts.APPROVED || 0,
        rejectedAmount: statusCounts.amounts.REJECTED || 0,
        pendingAmount: statusCounts.amounts.SUBMITTED || 0,
        reviewAmount: statusCounts.amounts.REVIEW_REQUIRED || 0,
      },
      trends: Array.from(trendMap.values()),
      riskMap,
      hospitalMonitoring: hospitalMonitoring.sort((a, b) => b.complianceScore - a.complianceScore),
      providerSummary,
      currencySummary,
      proceduresSummary,
      fraudSeverity,
      fraudSignals,
      suspiciousClaims,
      funds,
      notifications,
    });
  } catch (err) {
    next(err);
  }
};

export const listGovernmentClaims = async (req, res, next) => {
  try {
    const { filter } = buildClaimFilter(req);
    if (req.query?.status) filter.status = String(req.query.status).trim().toUpperCase();
    if (req.query?.hospitalId) filter.hospital = req.query.hospitalId;
    if (req.query?.patientId) filter.patient = req.query.patientId;
    if (req.query?.riskMin) filter.riskScore = { ...(filter.riskScore || {}), $gte: Number(req.query.riskMin) };
    if (req.query?.riskMax) filter.riskScore = { ...(filter.riskScore || {}), $lte: Number(req.query.riskMax) };
    if (req.query?.procedure) filter["procedures.code"] = String(req.query.procedure).trim().toUpperCase();

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const items = await Claim.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("hospital", "name code location")
      .populate("patient", "firstName lastName gender nationalId")
      .lean();

    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const listGovernmentHospitals = async (req, res, next) => {
  try {
    const country = req.query?.country ? String(req.query.country).trim().toUpperCase() : null;
    const hospitals = await Hospital.find(country ? { "location.country": country } : {})
      .select("name code location verification accreditations active")
      .lean();
    const hospitalIds = hospitals.map((row) => row._id);

    const [licenses, inspections, enforcementAgg] = await Promise.all([
      HospitalLicense.find({ hospital: { $in: hospitalIds } })
        .sort({ expiresAt: -1, createdAt: -1 })
        .lean(),
      HospitalInspection.aggregate([
        { $match: { hospital: { $in: hospitalIds } } },
        { $sort: { performedAt: -1, scheduledAt: -1, createdAt: -1 } },
        { $group: { _id: "$hospital", record: { $first: "$$ROOT" } } },
      ]),
      EnforcementAction.aggregate([
        { $match: { hospital: { $in: hospitalIds }, status: "OPEN" } },
        { $group: { _id: "$hospital", open: { $sum: 1 } } },
      ]),
    ]);

    const licenseMap = new Map();
    for (const lic of licenses) {
      const key = String(lic.hospital);
      if (!licenseMap.has(key)) licenseMap.set(key, lic);
    }
    const inspectionMap = new Map(inspections.map((row) => [String(row._id), row.record]));
    const enforcementMap = new Map(enforcementAgg.map((row) => [String(row._id), row.open]));

    const rows = hospitals.map((hospital) => ({
      id: hospital._id,
      name: hospital.name,
      code: hospital.code,
      country: hospital?.location?.country || "",
      region: hospital?.location?.region || "",
      verificationStatus: hospital?.verification?.status || "UNVERIFIED",
      license: licenseMap.get(String(hospital._id)) || null,
      inspection: inspectionMap.get(String(hospital._id)) || null,
      enforcementOpen: enforcementMap.get(String(hospital._id)) || 0,
    }));

    return res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const listInspections = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query?.hospitalId) filter.hospital = req.query.hospitalId;
    if (req.query?.status) filter.status = String(req.query.status).trim().toUpperCase();
    if (req.query?.country) filter.country = String(req.query.country).trim().toUpperCase();
    const items = await HospitalInspection.find(filter)
      .sort({ scheduledAt: -1 })
      .limit(200)
      .populate("hospital", "name code location")
      .populate("inspector", "name email role")
      .lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createInspection = async (req, res, next) => {
  try {
    const hospitalId = req.body?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "hospitalId is required" });
    const hospital = await Hospital.findById(hospitalId).select("location").lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    const payload = {
      hospital: hospitalId,
      country: req.body?.country || hospital?.location?.country || "",
      authority: req.body?.authority || "MINISTRY_OF_HEALTH",
      type: req.body?.type || "ROUTINE",
      status: "SCHEDULED",
      scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : new Date(),
      notes: String(req.body?.notes || "").trim(),
      inspector: req.user?._id || null,
    };

    const inspection = await HospitalInspection.create(payload);
    await notify({
      user: req.user?._id,
      category: "REGULATORY",
      title: "Inspection scheduled",
      body: "A hospital inspection has been scheduled.",
      hospital: hospitalId,
      meta: { inspectionId: inspection._id, hospitalId },
    });

    return res.status(201).json({ inspection });
  } catch (err) {
    next(err);
  }
};

export const updateInspection = async (req, res, next) => {
  try {
    const inspection = await HospitalInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ message: "Inspection not found" });
    const updates = {};
    if (req.body?.status) updates.status = String(req.body.status).trim().toUpperCase();
    if (req.body?.performedAt) updates.performedAt = new Date(req.body.performedAt);
    if (req.body?.findings) updates.findings = req.body.findings;
    if (req.body?.correctiveActions) updates.correctiveActions = req.body.correctiveActions;
    if (req.body?.complianceScore !== undefined) updates.complianceScore = Number(req.body.complianceScore || 0);
    if (req.body?.notes !== undefined) updates.notes = String(req.body.notes || "").trim();

    Object.assign(inspection, updates);
    await inspection.save();
    await HospitalLicense.updateMany(
      { hospital: inspection.hospital },
      { $set: { lastInspectionAt: inspection.performedAt || inspection.scheduledAt, complianceScore: inspection.complianceScore || 0 } }
    );

    return res.json({ inspection });
  } catch (err) {
    next(err);
  }
};

export const listEnforcementActions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query?.hospitalId) filter.hospital = req.query.hospitalId;
    if (req.query?.status) filter.status = String(req.query.status).trim().toUpperCase();
    if (req.query?.country) filter.country = String(req.query.country).trim().toUpperCase();
    const items = await EnforcementAction.find(filter)
      .sort({ issuedAt: -1 })
      .limit(200)
      .populate("hospital", "name code location")
      .populate("issuedBy", "name email role")
      .lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createEnforcementAction = async (req, res, next) => {
  try {
    const hospitalId = req.body?.hospitalId;
    if (!hospitalId) return res.status(400).json({ message: "hospitalId is required" });
    const hospital = await Hospital.findById(hospitalId).select("location").lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    const action = await EnforcementAction.create({
      hospital: hospitalId,
      country: req.body?.country || hospital?.location?.country || "",
      authority: req.body?.authority || "MINISTRY_OF_HEALTH",
      actionType: req.body?.actionType || "WARNING",
      status: "OPEN",
      issuedAt: new Date(),
      dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : null,
      amount: Number(req.body?.amount || 0),
      currency: req.body?.currency || "KES",
      notes: String(req.body?.notes || "").trim(),
      issuedBy: req.user?._id || null,
      relatedInspection: req.body?.inspectionId || null,
    });

    if (action.actionType === "SUSPEND_LICENSE" || action.actionType === "REVOKE_LICENSE") {
      const status = action.actionType === "SUSPEND_LICENSE" ? "SUSPENDED" : "REVOKED";
      await HospitalLicense.updateMany({ hospital: hospitalId }, { $set: { status } });
    }

    await notify({
      user: req.user?._id,
      category: "REGULATORY",
      title: "Enforcement action created",
      body: `Action ${action.actionType} has been issued.`,
      hospital: hospitalId,
      meta: { enforcementId: action._id, hospitalId },
    });

    return res.status(201).json({ action });
  } catch (err) {
    next(err);
  }
};

export const updateEnforcementAction = async (req, res, next) => {
  try {
    const action = await EnforcementAction.findById(req.params.id);
    if (!action) return res.status(404).json({ message: "Enforcement action not found" });
    if (req.body?.status) action.status = String(req.body.status).trim().toUpperCase();
    if (req.body?.notes !== undefined) action.notes = String(req.body.notes || "").trim();
    if (req.body?.resolved && action.status === "RESOLVED") {
      action.resolvedAt = new Date();
      action.resolvedBy = req.user?._id || null;
    }
    await action.save();
    return res.json({ action });
  } catch (err) {
    next(err);
  }
};

export const listHealthFunds = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query?.country) filter.country = String(req.query.country).trim().toUpperCase();
    const items = await HealthFund.find(filter).sort({ country: 1, code: 1 }).lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createHealthFund = async (req, res, next) => {
  try {
    const payload = {
      code: String(req.body?.code || "").trim().toUpperCase(),
      name: String(req.body?.name || "").trim(),
      country: String(req.body?.country || "").trim().toUpperCase(),
      currency: String(req.body?.currency || "KES").trim().toUpperCase(),
      status: req.body?.status || "ACTIVE",
      apiStatus: req.body?.apiStatus || "UNKNOWN",
      endpoints: req.body?.endpoints || {},
      contact: req.body?.contact || {},
      notes: String(req.body?.notes || "").trim(),
      metadata: req.body?.metadata || {},
    };
    if (!payload.code || !payload.name || !payload.country) {
      return res.status(400).json({ message: "code, name, and country are required" });
    }
    const fund = await HealthFund.create(payload);
    return res.status(201).json({ fund });
  } catch (err) {
    next(err);
  }
};

export const updateHealthFund = async (req, res, next) => {
  try {
    const fund = await HealthFund.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!fund) return res.status(404).json({ message: "Health fund not found" });
    return res.json({ fund });
  } catch (err) {
    next(err);
  }
};

export const listGovernmentNotifications = async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const listAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const [ledger, claimAudit, auditLogs] = await Promise.all([
      ComplianceLedger.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      ClaimAuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      AuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const items = [
      ...ledger.map((row) => ({
        source: "COMPLIANCE_LEDGER",
        event: row.event || row.action || "LEDGER_ENTRY",
        actorRole: row.actorRole || row.actor || null,
        createdAt: row.createdAt,
        payload: row.payload || row.details || {},
      })),
      ...claimAudit.map((row) => ({
        source: "CLAIM_AUDIT",
        event: row.event,
        actorRole: row.actorRole || null,
        createdAt: row.createdAt,
        payload: row.payload || {},
      })),
      ...auditLogs.map((row) => ({
        source: "SYSTEM_AUDIT",
        event: row.action || row.event || "AUDIT",
        actorRole: row.actorRole || null,
        createdAt: row.createdAt,
        payload: row.details || row.meta || {},
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({ items });
  } catch (err) {
    next(err);
  }
};
