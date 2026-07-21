import Appointment from "../models/Appointment.js";
import AuditLog from "../models/AuditLog.js";
import Claim from "../models/Claim.js";
import Invoice from "../models/Invoice.js";
import LabOrder from "../models/LabOrder.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/Notification.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import User from "../models/User.js";
import { getAdmissionsSummary } from "./admissionsService.js";
import { getBedManagementSummary } from "./bedManagementService.js";
import { getFinanceSummary } from "./financeService.js";
import { getLaboratorySummary } from "./laboratoryService.js";
import { getPharmacySummary } from "./pharmacyService.js";
import { getRadiologySummary } from "./radiologyService.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function buildExecutiveDashboardSummary({ hospital = {}, hospitalId = null, user = null } = {}) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [
    totalStaff,
    admissionsSummary,
    pharmacySummary,
    laboratorySummary,
    radiologySummary,
    bedManagementSummary,
    financeSummary,
    pendingClaims,
    pendingRequests,
    pharmacyRisk,
    laboratoryQueue,
    radiologyQueue,
    auditAlerts,
  ] = await Promise.all([
    User.countDocuments({
      ...hospital,
      role: { $nin: ["PATIENT", "GUEST"] },
    }),
    getAdmissionsSummary({ hospital }),
    getPharmacySummary({ hospital }),
    getLaboratorySummary({ hospital }),
    getRadiologySummary({ hospital }),
    getBedManagementSummary({ hospital }),
    getFinanceSummary({ hospitalId }),
    Claim.countDocuments({
      ...hospital,
      status: { $in: ["SUBMITTED", "REVIEW_REQUIRED"] },
    }),
    LeaveRequest.countDocuments({ ...hospital, status: "PENDING" }) +
      OvertimeRequest.countDocuments({ ...hospital, status: "PENDING" }) +
      ShiftRequest.countDocuments({ ...hospital, status: "PENDING" }),
    Notification.countDocuments({
      hospital: hospitalId || user?.hospital || null,
      user: user?._id || null,
      category: "PHARMACY",
      read: false,
      "meta.type": "PHARMACY_COVERAGE_RISK",
    }),
    LabOrder.countDocuments({ ...hospital, status: "Pending" }),
    Appointment.countDocuments({
      ...hospital,
      status: { $nin: ["Cancelled", "Completed", "NoShow"] },
    }),
    Notification.countDocuments({
      hospital: hospitalId || user?.hospital || null,
      user: user?._id || null,
      category: "AUDIT",
      read: false,
    }),
    AuditLog.countDocuments({
      ...hospital,
      action: { $in: ["BED_ASSIGN", "BED_RELEASE", "BED_TRANSFER", "BED_DISCHARGE"] },
    }),
  ]);

  const { admissionsToday, dischargesToday, pendingAdmissions } = admissionsSummary;
  const { pendingPrescriptions, lowStockItems, outOfStockItems } = pharmacySummary;
  const { pendingLabOrders, completedLabOrders, cancelledLabOrders } = laboratorySummary;
  const { pendingImagingStudies, completedImagingStudies, criticalFindingsBacklog } = radiologySummary;
  const { totalBeds, occupiedBeds, availableBeds, bedOccupancyRate, wardOccupancy } = bedManagementSummary;
  const {
    revenueToday,
    outstandingAmount,
    collectedAmount,
    cancelledAmount,
    invoiceCount,
    overdueInvoiceCount,
    totalClaims: financeTotalClaims,
    approvalRate,
    denialRate,
    reviewRequiredCount,
    highRiskClaimCount,
    averageCollectionDays,
    totalPreauth,
    preauthApprovalRate,
    pendingPreauthOverSla,
    actions,
  } = financeSummary;

  return {
    totalStaff,
    admissionsToday,
    dischargesToday,
    pendingClaims,
    revenueToday,
    totalBeds,
    occupiedBeds,
    availableBeds,
    bedOccupancyRate,
    wardOccupancy: wardOccupancy.slice(0, 6),
    pendingRequests,
    domains: {
      operations: {
        totalStaff,
        admissionsToday,
        dischargesToday,
        occupiedBeds,
        totalBeds,
        availableBeds,
        bedOccupancyRate,
        pendingRequests,
        pendingAdmissions,
        auditAlerts,
      },
      pharmacy: {
        risk: Boolean(pharmacyRisk),
        alerts: pharmacyRisk,
        laboratoryQueue,
        pendingPrescriptions,
        lowStockItems,
        outOfStockItems,
      },
      finance: {
        revenueToday,
        pendingClaims,
        outstandingAmount,
        collectedAmount,
        cancelledAmount,
        invoiceCount,
        overdueInvoiceCount,
        totalClaims: financeTotalClaims,
        approvalRate,
        denialRate,
        reviewRequiredCount,
        highRiskClaimCount,
        averageCollectionDays,
        totalPreauth,
        preauthApprovalRate,
        pendingPreauthOverSla,
        actions,
      },
      clinical: {
        laboratoryQueue,
        pendingLabOrders,
        completedLabOrders,
        cancelledLabOrders,
        radiologyQueue,
        pendingImagingStudies,
        completedImagingStudies,
        criticalFindingsBacklog,
      },
    },
    pharmacyCoverageRisk: Boolean(pharmacyRisk),
    laboratoryQueue,
    radiologyQueue,
    activeOverrides: 0,
    auditAlerts,
    generatedAt: new Date().toISOString(),
  };
}

export default buildExecutiveDashboardSummary;
