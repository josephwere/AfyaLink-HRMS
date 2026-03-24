import mongoose from "mongoose";
import Financial from "../models/Financial.js";
import Claim from "../models/Claim.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import Hospital from "../models/Hospital.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

const { Types } = mongoose;

function normalizeProvider(value) {
  return String(value || "UNSPECIFIED").trim().toUpperCase() || "UNSPECIFIED";
}

function toObjectId(value) {
  if (!value || !Types.ObjectId.isValid(String(value))) return null;
  return new Types.ObjectId(String(value));
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function pct(part, whole) {
  if (!whole) return 0;
  return Number(((Number(part || 0) / Number(whole || 0)) * 100).toFixed(1));
}

function daysBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function firstPaymentAt(financial) {
  const payments = Array.isArray(financial?.metadata?.payments) ? financial.metadata.payments : [];
  const stamps = payments
    .map((item) => new Date(item?.at || item?.createdAt || 0))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => a - b);
  return stamps[0] || null;
}

function ageBucket(days) {
  if (days <= 7) return "0_7";
  if (days <= 14) return "8_14";
  if (days <= 30) return "15_30";
  return "31_PLUS";
}

function safeHospitalName(map, id) {
  return map.get(String(id)) || "Unknown Hospital";
}

export async function getRevenueIntelligenceSnapshot({ hospitalId = null } = {}) {
  const settings = await getSystemSettingsDoc({ lean: true });
  const config = {
    denialRiskThreshold: Number(settings?.revenueCycle?.denialRiskThreshold || 65),
    overdueInvoiceDays: Number(settings?.revenueCycle?.overdueInvoiceDays || 14),
    preauthPendingSlaHours: Number(settings?.revenueCycle?.preauthPendingSlaHours || 24),
    targetCollectionDays: Number(settings?.revenueCycle?.targetCollectionDays || 7),
    autoFlagHighRiskClaims: settings?.revenueCycle?.autoFlagHighRiskClaims !== false,
  };

  const hospitalObjectId = toObjectId(hospitalId);
  const financialMatch = hospitalObjectId ? { hospital: hospitalObjectId } : {};
  const claimMatch = hospitalObjectId ? { hospital: hospitalObjectId } : {};
  const pendingCutoff = new Date(Date.now() - config.overdueInvoiceDays * 24 * 60 * 60 * 1000);
  const preauthCutoff = new Date(Date.now() - config.preauthPendingSlaHours * 60 * 60 * 1000);

  const [financials, claims, preauthRows, hospitals] = await Promise.all([
    Financial.find(financialMatch)
      .select("hospital invoiceNumber total status insuranceClaim metadata createdAt updatedAt")
      .lean(),
    Claim.find(claimMatch)
      .select("hospital provider totalAmount status riskScore riskFlags createdAt")
      .lean(),
    InsuranceAuthorization.aggregate([
      {
        $lookup: {
          from: "encounters",
          localField: "encounter",
          foreignField: "_id",
          as: "encounterDoc",
        },
      },
      {
        $unwind: {
          path: "$encounterDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(hospitalObjectId
        ? [
            {
              $match: {
                "encounterDoc.hospital": hospitalObjectId,
              },
            },
          ]
        : []),
      {
        $project: {
          provider: 1,
          status: 1,
          createdAt: 1,
          encounterHospital: "$encounterDoc.hospital",
        },
      },
    ]),
    hospitalObjectId
      ? Hospital.find({ _id: hospitalObjectId }).select("name").lean()
      : Hospital.find({ active: { $ne: false } }).select("name").lean(),
  ]);

  const hospitalNameMap = new Map(hospitals.map((row) => [String(row._id), row.name || "Hospital"]));

  const paidFinancials = financials.filter((row) => String(row.status || "").toUpperCase() === "PAID");
  const pendingFinancials = financials.filter((row) => String(row.status || "").toUpperCase() === "PENDING");
  const cancelledFinancials = financials.filter((row) => String(row.status || "").toUpperCase() === "CANCELLED");
  const outstandingAmount = pendingFinancials.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const collectedAmount = paidFinancials.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const cancelledAmount = cancelledFinancials.reduce((sum, row) => sum + Number(row.total || 0), 0);

  const collectionDays = paidFinancials
    .map((row) => {
      const paidAt = firstPaymentAt(row);
      return paidAt ? daysBetween(row.createdAt, paidAt) : null;
    })
    .filter((value) => value !== null);

  const agingBuckets = { "0_7": 0, "8_14": 0, "15_30": 0, "31_PLUS": 0 };
  const overdueInvoices = pendingFinancials
    .filter((row) => new Date(row.createdAt) <= pendingCutoff)
    .map((row) => {
      const ageDays = daysBetween(row.createdAt, new Date());
      agingBuckets[ageBucket(ageDays)] += 1;
      return {
        invoiceId: row._id,
        invoiceNumber: row.invoiceNumber || "Invoice",
        total: Number(row.total || 0),
        ageDays,
        hospitalId: row.hospital || null,
        hospitalName: safeHospitalName(hospitalNameMap, row.hospital),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);

  const totalClaims = claims.length;
  const approvedClaims = claims.filter((row) => ["APPROVED", "PAID"].includes(String(row.status || "").toUpperCase())).length;
  const rejectedClaims = claims.filter((row) => String(row.status || "").toUpperCase() === "REJECTED").length;
  const reviewClaims = claims.filter((row) => String(row.status || "").toUpperCase() === "REVIEW_REQUIRED").length;
  const highRiskClaims = claims.filter((row) => Number(row.riskScore || 0) >= config.denialRiskThreshold);

  const payerMixMap = new Map();
  const denialReasonMap = new Map();
  const hospitalComparisonMap = new Map();

  claims.forEach((row) => {
    const providerCode = normalizeProvider(row?.provider?.code || row?.provider);
    const currentMix = payerMixMap.get(providerCode) || { providerCode, claims: 0, totalAmount: 0, rejected: 0 };
    currentMix.claims += 1;
    currentMix.totalAmount += Number(row.totalAmount || 0);
    if (String(row.status || "").toUpperCase() === "REJECTED") currentMix.rejected += 1;
    payerMixMap.set(providerCode, currentMix);

    (Array.isArray(row.riskFlags) ? row.riskFlags : []).forEach((flag) => {
      if (!flag) return;
      const item = denialReasonMap.get(flag) || { code: flag, count: 0, rejectedCount: 0, reviewCount: 0 };
      item.count += 1;
      if (String(row.status || "").toUpperCase() === "REJECTED") item.rejectedCount += 1;
      if (String(row.status || "").toUpperCase() === "REVIEW_REQUIRED") item.reviewCount += 1;
      denialReasonMap.set(flag, item);
    });

    const key = String(row.hospital || "GLOBAL");
    const hospitalRow = hospitalComparisonMap.get(key) || {
      hospitalId: row.hospital || null,
      hospitalName: safeHospitalName(hospitalNameMap, row.hospital),
      claims: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      reviewRequired: 0,
    };
    hospitalRow.claims += 1;
    hospitalRow.totalAmount += Number(row.totalAmount || 0);
    const status = String(row.status || "").toUpperCase();
    if (["APPROVED", "PAID"].includes(status)) hospitalRow.approved += 1;
    if (status === "REJECTED") hospitalRow.rejected += 1;
    if (status === "REVIEW_REQUIRED") hospitalRow.reviewRequired += 1;
    hospitalComparisonMap.set(key, hospitalRow);
  });

  const payerMix = [...payerMixMap.values()]
    .map((row) => ({
      ...row,
      denialRate: pct(row.rejected, row.claims),
      shareOfClaims: pct(row.claims, totalClaims),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 8);

  const topDenialReasons = [...denialReasonMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const preauthSummaryMap = new Map();
  let pendingPreauthOverSla = 0;
  preauthRows.forEach((row) => {
    const provider = normalizeProvider(row.provider || "PREAUTH");
    const bucket = preauthSummaryMap.get(provider) || { providerCode: provider, total: 0, pending: 0, approved: 0, rejected: 0 };
    bucket.total += 1;
    const status = String(row.status || "PENDING").toUpperCase();
    if (status === "PENDING") {
      bucket.pending += 1;
      if (new Date(row.createdAt || 0) <= preauthCutoff) pendingPreauthOverSla += 1;
    }
    if (status === "APPROVED") bucket.approved += 1;
    if (status === "REJECTED") bucket.rejected += 1;
    preauthSummaryMap.set(provider, bucket);
  });
  const preauthSummary = [...preauthSummaryMap.values()].map((row) => ({
    ...row,
    approvalRate: pct(row.approved, row.total),
  }));
  const totalPreauth = preauthRows.length;
  const approvedPreauth = preauthRows.filter((row) => String(row.status || "").toUpperCase() === "APPROVED").length;

  const actions = [];
  const denialRate = pct(rejectedClaims, totalClaims);
  const approvalRate = pct(approvedClaims, totalClaims);
  const averageCollectionDays = Number(average(collectionDays).toFixed(1));

  if (denialRate >= 12) {
    actions.push({
      severity: "HIGH",
      title: "High denial pressure",
      detail: `Rejected claims are at ${denialRate}% of submitted volume. Prioritize payer-rule cleanup and coding review for the top denial signals.`,
    });
  }
  if (pendingPreauthOverSla > 0) {
    actions.push({
      severity: "MEDIUM",
      title: "Prior auth backlog is aging",
      detail: `${pendingPreauthOverSla} pre-auth requests are beyond the ${config.preauthPendingSlaHours}-hour target.`,
    });
  }
  if (overdueInvoices.length > 0) {
    actions.push({
      severity: "MEDIUM",
      title: "Outstanding invoice follow-up needed",
      detail: `${overdueInvoices.length} pending invoices are older than ${config.overdueInvoiceDays} days.`,
    });
  }
  if (config.autoFlagHighRiskClaims && highRiskClaims.length > 0) {
    actions.push({
      severity: "HIGH",
      title: "High-risk claims need proactive review",
      detail: `${highRiskClaims.length} claims are at or above the configured risk threshold of ${config.denialRiskThreshold}.`,
    });
  }
  if (averageCollectionDays > config.targetCollectionDays) {
    actions.push({
      severity: "WATCH",
      title: "Collection cycle is slower than target",
      detail: `Average collection cycle is ${averageCollectionDays} days against a ${config.targetCollectionDays}-day target.`,
    });
  }

  const hospitalComparisons = hospitalObjectId
    ? []
    : [...hospitalComparisonMap.values()]
        .map((row) => ({
          ...row,
          approvalRate: pct(row.approved, row.claims),
          denialRate: pct(row.rejected, row.claims),
        }))
        .sort((a, b) => b.denialRate - a.denialRate || b.reviewRequired - a.reviewRequired)
        .slice(0, 8);

  return {
    scope: {
      hospitalId: hospitalObjectId ? String(hospitalObjectId) : null,
      hospitalName: hospitalObjectId ? safeHospitalName(hospitalNameMap, hospitalObjectId) : "All hospitals",
    },
    config,
    summary: {
      outstandingAmount,
      collectedAmount,
      cancelledAmount,
      invoiceCount: financials.length,
      overdueInvoiceCount: overdueInvoices.length,
      totalClaims,
      approvalRate,
      denialRate,
      reviewRequiredCount: reviewClaims,
      highRiskClaimCount: highRiskClaims.length,
      averageCollectionDays,
      totalPreauth,
      preauthApprovalRate: pct(approvedPreauth, totalPreauth),
      pendingPreauthOverSla,
    },
    agingBuckets,
    payerMix,
    topDenialReasons,
    overdueInvoices,
    preauthSummary,
    hospitalComparisons,
    actions,
  };
}
