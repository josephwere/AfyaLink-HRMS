import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import LabOrder from "../models/LabOrder.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import SecurityIncident from "../models/SecurityIncident.js";
import Notification from "../models/Notification.js";
import CallSession from "../models/CallSession.js";
import Hospital from "../models/Hospital.js";
import Bed from "../models/Bed.js";
import AuditLog from "../models/AuditLog.js";
import Household from "../models/Household.js";
import FieldVisit from "../models/FieldVisit.js";
import VaccinationRecord from "../models/VaccinationRecord.js";
import MaternalRecord from "../models/MaternalRecord.js";
import ChwReferral from "../models/ChwReferral.js";
import DiseaseReport from "../models/DiseaseReport.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { buildLinkedMinorSummariesForUser, resolvePatientIdsForUser } from "../services/familyMonitoringService.js";

const LICENSE_ROLES = [
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
];

const DASHBOARD_ACTION_MATRIX = [
  { dashboard: "Doctor", route: "/doctor", action: "Create Encounter", target: "POST /api/encounters", expectedResult: "Encounter opened and patient workflow starts" },
  { dashboard: "Doctor", route: "/doctor", action: "Send To Pharmacy", target: "POST /api/pharmacy/referrals", expectedResult: "Pharmacy referral created for patient" },
  { dashboard: "Nurse", route: "/nurse", action: "Record Vitals", target: "POST /api/encounters/:id/vitals", expectedResult: "Vitals saved to encounter timeline" },
  { dashboard: "Lab Tech", route: "/lab-tech", action: "Order Lab Test", target: "POST /api/lab/orders", expectedResult: "Lab order queued and visible in worklist" },
  { dashboard: "Radiologist", route: "/radiologist", action: "Upload Report", target: "POST /api/imaging/reports", expectedResult: "Imaging report attached to patient file" },
  { dashboard: "Therapist", route: "/therapist", action: "Create Session Note", target: "POST /api/therapy/sessions", expectedResult: "Therapy note saved and auditable" },
  { dashboard: "Receptionist", route: "/receptionist", action: "Register Walk-in", target: "POST /api/patients", expectedResult: "Patient profile created" },
  { dashboard: "Surgeon", route: "/surgeon", action: "Schedule Surgery", target: "POST /api/appointments", expectedResult: "Surgery appointment booked" },
  { dashboard: "Hospital Admin", route: "/hospital-admin", action: "Register Staff", target: "POST /api/staff", expectedResult: "Staff account created and scoped to hospital" },
  { dashboard: "Hospital Admin", route: "/hospital-admin", action: "Initiate Staff Transfer", target: "POST /api/staff-transfers", expectedResult: "Transfer request created for source+target approval" },
  { dashboard: "Hospital Admin", route: "/hospital-admin", action: "Demote Staff To Patient", target: "PATCH /api/users/:id/demote-to-patient", expectedResult: "Staff access removed and user downgraded to PATIENT" },
  { dashboard: "Hospital Admin Assistant", route: "/hospital-admin", action: "Assign Staff Credentials", target: "PUT /api/staff/:id", expectedResult: "Staff profile updated with verified identity fields" },
  { dashboard: "HR Manager", route: "/hr", action: "Approve Leave", target: "PATCH /api/workforce/leave/:id/approve", expectedResult: "Leave request approved" },
  { dashboard: "Payroll Officer", route: "/payroll", action: "Create Invoice", target: "POST /api/financials/invoice", expectedResult: "Invoice generated and auditable" },
  { dashboard: "Security Admin", route: "/security-admin", action: "Open Incident", target: "POST /api/security/incidents", expectedResult: "Incident lifecycle starts with audit trail" },
  { dashboard: "Security Officer", route: "/security-officer", action: "Update Incident", target: "PATCH /api/security/incidents/:id", expectedResult: "Incident status updated" },
  { dashboard: "Community Health Worker", route: "/community-health-worker", action: "Create Referral", target: "POST /api/chw/referrals", expectedResult: "Referral assigned to facility queue" },
  { dashboard: "Super Admin", route: "/super-admin", action: "Register Hospital", target: "POST /api/hospitals", expectedResult: "Hospital created and visible in latest-first list" },
  { dashboard: "System Admin", route: "/super-admin", action: "Assign Hospital Admin", target: "POST /api/hospitals/:id/admin", expectedResult: "Admin linked to selected hospital" },
  { dashboard: "Emergency Command", route: "/ops/emergency-command", action: "Track Escalations", target: "GET /api/dashboard/ops/emergency-command", expectedResult: "Live emergency queue and dispatch metrics shown" },
  { dashboard: "Neonatal ICU", route: "/ops/neonatal-icu", action: "Monitor NICU", target: "GET /api/dashboard/ops/neonatal-icu", expectedResult: "NICU load and follow-up risks shown" },
  { dashboard: "Dialysis Ops", route: "/ops/dialysis", action: "Track Sessions", target: "GET /api/dashboard/ops/dialysis", expectedResult: "Dialysis sessions and backlog shown" },
  { dashboard: "Oncology Day-Care", route: "/ops/oncology-daycare", action: "Track Day-Care", target: "GET /api/dashboard/ops/oncology-daycare", expectedResult: "Oncology cycles and queue status shown" },
  { dashboard: "All Roles", route: "global", action: "Ask NeuroEdge Assistant", target: "POST /api/ai/assistant/chat", expectedResult: "Assistant response returned with safety envelope" },
];

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

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function resolveHospitalScope(req) {
  const role = normalizeRole(req.user?.role || "");
  if (req.query?.hospitalId && ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || null;
}

function hospitalFilter(req) {
  const hospital = resolveHospitalScope(req);
  return hospital ? { hospital } : {};
}

async function buildEscalationSummary({ hospitalId = null, userId = null, limit = 6 } = {}) {
  const match = {
    ...(hospitalId ? { hospital: hospitalId } : {}),
    ...(userId ? { user: userId } : {}),
    "meta.type": "NURSE_ESCALATION",
  };
  const notifications = await Notification.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  const patientIds = [...new Set(notifications.map((row) => String(row?.meta?.patientId || "")).filter(Boolean))];
  const patients = patientIds.length
    ? await Patient.find({ _id: { $in: patientIds } }).select("firstName lastName").lean()
    : [];
  const patientById = new Map(
    patients.map((row) => [String(row._id), [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || "Patient"])
  );
  const items = notifications.map((row) => ({
    id: row._id,
    title: row.title || "",
    body: row.body || "",
    createdAt: row.createdAt,
    read: Boolean(row.read),
    patientId: row?.meta?.patientId || null,
    patientName: patientById.get(String(row?.meta?.patientId || "")) || "Patient",
    path: row?.meta?.path || "",
    resolvedAt: row?.meta?.resolvedAt || null,
    missingRequirements: Array.isArray(row?.meta?.missingRequirements) ? row.meta.missingRequirements : [],
  }));
  return {
    openCount: items.filter((row) => !row.resolvedAt).length,
    unreadCount: items.filter((row) => !row.read).length,
    items,
  };
}

export async function doctorDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const doctor = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const weekStart = daysAgo(6);

    const [
      appointmentsToday,
      upcomingAppointments,
      activeEncounters,
      completedThisWeek,
      pendingLabResults,
      leavePending,
      overtimePending,
      shiftPending,
      escalationSummary,
    ] = await Promise.all([
      Appointment.countDocuments({
        ...hospital,
        doctor,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: { $ne: "Cancelled" },
      }),
      Appointment.countDocuments({
        ...hospital,
        doctor,
        scheduledAt: { $gt: todayEnd },
        status: "Scheduled",
      }),
      Encounter.countDocuments({
        ...hospital,
        doctor,
        state: { $ne: WORKFLOW.CLOSED },
      }),
      Appointment.countDocuments({
        ...hospital,
        doctor,
        status: "Completed",
        scheduledAt: { $gte: weekStart },
      }),
      LabOrder.countDocuments({
        ...hospital,
        status: "Pending",
      }),
      LeaveRequest.countDocuments({ requester: doctor, status: "PENDING" }),
      OvertimeRequest.countDocuments({ requester: doctor, status: "PENDING" }),
      ShiftRequest.countDocuments({ requester: doctor, status: "PENDING" }),
      buildEscalationSummary({ hospitalId: hospital.hospital, userId: doctor }),
    ]);

    const expiry = req.user?.licenseExpiry ? new Date(req.user.licenseExpiry) : null;
    const licenseExpiryDays =
      expiry && !Number.isNaN(expiry.getTime())
        ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    res.json({
      appointmentsToday,
      upcomingAppointments,
      activeEncounters,
      completedThisWeek,
      pendingLabResults,
      licenseExpiryDays,
      pendingRequests: {
        leave: leavePending,
        overtime: overtimePending,
        shift: shiftPending,
        total: leavePending + overtimePending + shiftPending,
      },
      escalationSummary,
    });
  } catch (err) {
    console.error("Doctor dashboard error:", err);
    res.status(500).json({ message: "Failed to load doctor dashboard" });
  }
}

export async function nurseDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const userId = req.user._id;

    const [
      patientsTotal,
      appointmentsToday,
      pendingLabOrders,
      leavePending,
      overtimePending,
      shiftPending,
      escalationSummary,
    ] = await Promise.all([
      Patient.countDocuments(hospital),
      Appointment.countDocuments({
        ...hospital,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: { $ne: "Cancelled" },
      }),
      LabOrder.countDocuments({ ...hospital, status: "Pending" }),
      LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
      OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
      ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
      buildEscalationSummary({ hospitalId: hospital.hospital }),
    ]);

    res.json({
      patientsTotal,
      appointmentsToday,
      pendingLabOrders,
      pendingRequests: {
        leave: leavePending,
        overtime: overtimePending,
        shift: shiftPending,
        total: leavePending + overtimePending + shiftPending,
      },
      escalationSummary,
    });
  } catch (err) {
    console.error("Nurse dashboard error:", err);
    res.status(500).json({ message: "Failed to load nurse dashboard" });
  }
}

export async function hrDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const thirtyDays = daysAgo(30);
    const staffFilter = {
      ...hospital,
      role: { $nin: ["PATIENT", "GUEST"] },
    };

    const [
      totalStaff,
      newHires,
      doctors,
      nurses,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      leavePending,
      overtimePending,
      shiftPending,
    ] = await Promise.all([
      User.countDocuments(staffFilter),
      User.countDocuments({ ...staffFilter, createdAt: { $gte: thirtyDays } }),
      User.countDocuments({ ...hospital, role: "DOCTOR" }),
      User.countDocuments({ ...hospital, role: "NURSE" }),
      User.countDocuments({
        ...staffFilter,
        $or: [
          { phone: { $exists: false } },
          { phone: "" },
          { nationalIdNumber: { $exists: false } },
          { nationalIdNumber: "" },
        ],
      }),
      User.countDocuments({
        ...staffFilter,
        active: false,
      }),
      User.countDocuments({
        ...hospital,
        role: { $in: LICENSE_ROLES },
        $or: [
          { licenseNumber: { $exists: false } },
          { licenseNumber: "" },
        ],
      }),
      LeaveRequest.countDocuments({ ...hospital, status: "PENDING" }),
      OvertimeRequest.countDocuments({ ...hospital, status: "PENDING" }),
      ShiftRequest.countDocuments({ ...hospital, status: "PENDING" }),
    ]);

    res.json({
      totalStaff,
      newHires,
      doctors,
      nurses,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      pendingRequests: {
        leave: leavePending,
        overtime: overtimePending,
        shift: shiftPending,
        total: leavePending + overtimePending + shiftPending,
      },
    });
  } catch (err) {
    console.error("HR dashboard error:", err);
    res.status(500).json({ message: "Failed to load HR dashboard" });
  }
}

export async function payrollDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const monthStart = startOfMonth();
    const overdueDate = daysAgo(30);
    const [
      unpaidInvoices,
      paidInvoices,
      invoicesThisMonth,
      totalThisMonth,
      paidThisMonth,
      overduePayroll,
      leavePending,
      overtimePending,
      shiftPending,
    ] = await Promise.all([
      Invoice.countDocuments({ ...hospital, status: "Unpaid" }),
      Invoice.countDocuments({ ...hospital, status: "Paid" }),
      Invoice.countDocuments({ ...hospital, createdAt: { $gte: monthStart } }),
      Invoice.aggregate([
        { $match: { ...hospital, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        { $match: { ...hospital, status: "Paid", paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({
        ...hospital,
        status: "Unpaid",
        createdAt: { $lte: overdueDate },
      }),
      LeaveRequest.countDocuments({ ...hospital, status: "PENDING" }),
      OvertimeRequest.countDocuments({ ...hospital, status: "PENDING" }),
      ShiftRequest.countDocuments({ ...hospital, status: "PENDING" }),
    ]);

    res.json({
      unpaidInvoices,
      paidInvoices,
      invoicesThisMonth,
      totalThisMonth: totalThisMonth[0]?.total || 0,
      paidThisMonth: paidThisMonth[0]?.total || 0,
      overduePayroll,
      pendingApprovals: leavePending + overtimePending + shiftPending,
    });
  } catch (err) {
    console.error("Payroll dashboard error:", err);
    res.status(500).json({ message: "Failed to load payroll dashboard" });
  }
}

export async function staffDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [
      leavePending,
      overtimePending,
      shiftPending,
      hospitalRequests,
      notificationsUnread,
      appointmentsToday,
    ] = await Promise.all([
      LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
      OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
      ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
      LeaveRequest.countDocuments({ ...hospital, status: "PENDING" }),
      Notification.countDocuments({ user: userId, read: false }),
      Appointment.countDocuments({
        ...hospital,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: { $ne: "Cancelled" },
      }),
    ]);

    res.json({
      myPendingRequests: leavePending + overtimePending + shiftPending,
      hospitalPendingRequests: hospitalRequests,
      notificationsUnread,
      appointmentsToday,
    });
  } catch (err) {
    console.error("Staff dashboard error:", err);
    res.status(500).json({ message: "Failed to load staff dashboard" });
  }
}

export async function radiologistDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [pendingImagingOrders, completedToday, unreadNotifications, myPendingRequests] =
      await Promise.all([
        LabOrder.countDocuments({ ...hospital, status: "Pending" }),
        LabOrder.countDocuments({
          ...hospital,
          status: "Completed",
          completedAt: { $gte: todayStart, $lte: todayEnd },
        }),
        Notification.countDocuments({ user: userId, read: false }),
        Promise.all([
          LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
          OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
          ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
        ]).then(([l, o, s]) => l + o + s),
      ]);

    return res.json({
      pendingImagingOrders,
      completedToday,
      unreadNotifications,
      myPendingRequests,
    });
  } catch (err) {
    console.error("Radiologist dashboard error:", err);
    return res.status(500).json({ message: "Failed to load radiologist dashboard" });
  }
}

export async function therapistDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [appointmentsToday, upcomingAppointments, unreadNotifications, myPendingRequests] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          status: { $ne: "Cancelled" },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gt: todayEnd },
          status: "Scheduled",
        }),
        Notification.countDocuments({ user: userId, read: false }),
        Promise.all([
          LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
          OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
          ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
        ]).then(([l, o, s]) => l + o + s),
      ]);

    return res.json({
      appointmentsToday,
      upcomingAppointments,
      unreadNotifications,
      myPendingRequests,
    });
  } catch (err) {
    console.error("Therapist dashboard error:", err);
    return res.status(500).json({ message: "Failed to load therapist dashboard" });
  }
}

export async function receptionistDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [appointmentsToday, patientsTotal, unreadNotifications, myPendingRequests] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          status: { $ne: "Cancelled" },
        }),
        Patient.countDocuments(hospital),
        Notification.countDocuments({ user: userId, read: false }),
        Promise.all([
          LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
          OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
          ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
        ]).then(([l, o, s]) => l + o + s),
      ]);

    return res.json({
      appointmentsToday,
      patientsTotal,
      unreadNotifications,
      myPendingRequests,
    });
  } catch (err) {
    console.error("Receptionist dashboard error:", err);
    return res.status(500).json({ message: "Failed to load receptionist dashboard" });
  }
}

export async function surgeonDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const surgeryReasonMatcher = /surgery|procedure|operation/i;
    const [surgeriesToday, upcomingSurgeries, activeEncounters, unreadNotifications, myPendingRequests] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          doctor: userId,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: surgeryReasonMatcher },
          status: { $ne: "Cancelled" },
        }),
        Appointment.countDocuments({
          ...hospital,
          doctor: userId,
          scheduledAt: { $gt: todayEnd },
          reason: { $regex: surgeryReasonMatcher },
          status: "Scheduled",
        }),
        Encounter.countDocuments({
          ...hospital,
          doctor: userId,
          state: { $ne: WORKFLOW.CLOSED },
        }),
        Notification.countDocuments({ user: userId, read: false }),
        Promise.all([
          LeaveRequest.countDocuments({ requester: userId, status: "PENDING" }),
          OvertimeRequest.countDocuments({ requester: userId, status: "PENDING" }),
          ShiftRequest.countDocuments({ requester: userId, status: "PENDING" }),
        ]).then(([l, o, s]) => l + o + s),
      ]);

    return res.json({
      surgeriesToday,
      upcomingSurgeries,
      activeEncounters,
      unreadNotifications,
      myPendingRequests,
    });
  } catch (err) {
    console.error("Surgeon dashboard error:", err);
    return res.status(500).json({ message: "Failed to load surgeon dashboard" });
  }
}

export async function triageOpsDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [arrivalsToday, pendingTriage, activeEncounters, urgentLabBacklog] = await Promise.all([
      Appointment.countDocuments({
        ...hospital,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: { $in: ["Scheduled", "CheckedIn"] },
      }),
      Appointment.countDocuments({
        ...hospital,
        status: "CheckedIn",
      }),
      Encounter.countDocuments({
        ...hospital,
        state: { $ne: WORKFLOW.CLOSED },
      }),
      LabOrder.countDocuments({
        ...hospital,
        status: "Pending",
      }),
    ]);

    return res.json({
      arrivalsToday,
      pendingTriage,
      activeEncounters,
      urgentLabBacklog,
    });
  } catch (err) {
    console.error("Triage ops dashboard error:", err);
    return res.status(500).json({ message: "Failed to load triage ops dashboard" });
  }
}

export async function icuOpsDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [activeInpatients, admissionsToday, highRiskFollowups, pendingLabResults] =
      await Promise.all([
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
        }),
        Encounter.countDocuments({
          ...hospital,
          admittedAt: { $gte: todayStart, $lte: todayEnd },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: /icu|critical|ward|follow[\s-]?up/i },
          status: { $ne: "Cancelled" },
        }),
        LabOrder.countDocuments({
          ...hospital,
          status: "Pending",
        }),
      ]);

    return res.json({
      activeInpatients,
      admissionsToday,
      highRiskFollowups,
      pendingLabResults,
    });
  } catch (err) {
    console.error("ICU ops dashboard error:", err);
    return res.status(500).json({ message: "Failed to load ICU ops dashboard" });
  }
}

export async function theatreOpsDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const surgeryMatcher = /surgery|procedure|operation|theatre/i;

    const [surgeriesToday, upcomingSurgeries, activeSurgicalEncounters, postOpFollowups] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: surgeryMatcher },
          status: { $ne: "Cancelled" },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gt: todayEnd },
          reason: { $regex: surgeryMatcher },
          status: "Scheduled",
        }),
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gt: todayStart },
          reason: { $regex: /post[\s-]?op|follow[\s-]?up/i },
          status: "Scheduled",
        }),
      ]);

    return res.json({
      surgeriesToday,
      upcomingSurgeries,
      activeSurgicalEncounters,
      postOpFollowups,
    });
  } catch (err) {
    console.error("Theatre ops dashboard error:", err);
    return res.status(500).json({ message: "Failed to load theatre ops dashboard" });
  }
}

export async function imagingOpsDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [imagingPending, imagingCompletedToday, criticalReadsBacklog, openEquipmentIssues] =
      await Promise.all([
        LabOrder.countDocuments({
          ...hospital,
          status: "Pending",
        }),
        LabOrder.countDocuments({
          ...hospital,
          status: "Completed",
          completedAt: { $gte: todayStart, $lte: todayEnd },
        }),
        Appointment.countDocuments({
          ...hospital,
          reason: { $regex: /ct|mri|x[\s-]?ray|ultrasound|imaging/i },
          status: "Scheduled",
        }),
        Notification.countDocuments({
          user: req.user._id,
          read: false,
        }),
      ]);

    return res.json({
      imagingPending,
      imagingCompletedToday,
      criticalReadsBacklog,
      openEquipmentIssues,
    });
  } catch (err) {
    console.error("Imaging ops dashboard error:", err);
    return res.status(500).json({ message: "Failed to load imaging ops dashboard" });
  }
}

export async function emergencyCommandDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [activeEmergencies, escalatedIncidents, ambulanceDispatchesToday, triageBacklog] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          status: "Scheduled",
          reason: { $regex: /emergency|trauma|critical|ambulance/i },
        }),
        SecurityIncident.countDocuments({
          ...hospital,
          status: "ESCALATED",
        }),
        Appointment.countDocuments({
          ...hospital,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: /ambulance|transfer/i },
        }),
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
          riskLevel: { $in: ["HIGH", "CRITICAL"] },
        }),
      ]);

    return res.json({
      activeEmergencies,
      escalatedIncidents,
      ambulanceDispatchesToday,
      triageBacklog,
    });
  } catch (err) {
    console.error("Emergency command dashboard error:", err);
    return res.status(500).json({ message: "Failed to load emergency command dashboard" });
  }
}

export async function neonatalIcuDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [nicuAdmissionsToday, activeNicuCases, highRiskFollowups, pendingCriticalLabs] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: /nicu|neonatal|newborn|incubator/i },
          status: { $ne: "Cancelled" },
        }),
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
          department: { $regex: /nicu|neonatal/i },
        }),
        Appointment.countDocuments({
          ...hospital,
          status: "Scheduled",
          reason: { $regex: /nicu follow|newborn follow|neonatal follow/i },
        }),
        LabOrder.countDocuments({
          ...hospital,
          status: "Pending",
          testName: { $regex: /bilirubin|blood gas|sepsis|nicu/i },
        }),
      ]);

    return res.json({
      nicuAdmissionsToday,
      activeNicuCases,
      highRiskFollowups,
      pendingCriticalLabs,
    });
  } catch (err) {
    console.error("Neonatal ICU dashboard error:", err);
    return res.status(500).json({ message: "Failed to load neonatal ICU dashboard" });
  }
}

export async function dialysisOpsDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [sessionsToday, upcomingSessions, activeDialysisCases, delayedSessions] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: /dialysis|hemodialysis|peritoneal/i },
          status: { $ne: "Cancelled" },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gt: todayEnd },
          reason: { $regex: /dialysis|hemodialysis|peritoneal/i },
          status: "Scheduled",
        }),
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
          department: { $regex: /dialysis|renal/i },
        }),
        Appointment.countDocuments({
          ...hospital,
          reason: { $regex: /dialysis|hemodialysis|peritoneal/i },
          status: "Scheduled",
          scheduledAt: { $lte: new Date(Date.now() - 30 * 60 * 1000) },
        }),
      ]);

    return res.json({
      sessionsToday,
      upcomingSessions,
      activeDialysisCases,
      delayedSessions,
    });
  } catch (err) {
    console.error("Dialysis ops dashboard error:", err);
    return res.status(500).json({ message: "Failed to load dialysis ops dashboard" });
  }
}

export async function oncologyDaycareDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [cyclesToday, upcomingCycles, activeOncologyCases, pendingChemoOrders] =
      await Promise.all([
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gte: todayStart, $lte: todayEnd },
          reason: { $regex: /oncology|chemotherapy|radiotherapy|daycare/i },
          status: { $ne: "Cancelled" },
        }),
        Appointment.countDocuments({
          ...hospital,
          scheduledAt: { $gt: todayEnd },
          reason: { $regex: /oncology|chemotherapy|radiotherapy|daycare/i },
          status: "Scheduled",
        }),
        Encounter.countDocuments({
          ...hospital,
          state: { $ne: WORKFLOW.CLOSED },
          department: { $regex: /oncology|cancer/i },
        }),
        Prescription.countDocuments({
          ...hospital,
          status: { $in: ["Pending", "Active"] },
          medication: { $regex: /chemo|oncology|cancer/i },
        }),
      ]);

    return res.json({
      cyclesToday,
      upcomingCycles,
      activeOncologyCases,
      pendingChemoOrders,
    });
  } catch (err) {
    console.error("Oncology day-care dashboard error:", err);
    return res.status(500).json({ message: "Failed to load oncology day-care dashboard" });
  }
}

export async function labTechDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const overdueDate = daysAgo(2);

    const [
      pendingOrders,
      completedToday,
      ordersToday,
      overdueOrders,
    ] = await Promise.all([
      LabOrder.countDocuments({ ...hospital, status: "Pending" }),
      LabOrder.countDocuments({
        ...hospital,
        status: "Completed",
        completedAt: { $gte: todayStart, $lte: todayEnd },
      }),
      LabOrder.countDocuments({
        ...hospital,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      LabOrder.countDocuments({
        ...hospital,
        status: "Pending",
        createdAt: { $lte: overdueDate },
      }),
    ]);

    res.json({
      pendingOrders,
      completedToday,
      ordersToday,
      overdueOrders,
    });
  } catch (err) {
    console.error("Lab dashboard error:", err);
    res.status(500).json({ message: "Failed to load lab dashboard" });
  }
}

export async function securityAdminDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [openIncidents, escalatedIncidents, incidentsToday, officersActive] =
      await Promise.all([
        SecurityIncident.countDocuments({
          ...hospital,
          status: { $in: ["OPEN", "INVESTIGATING"] },
        }),
        SecurityIncident.countDocuments({
          ...hospital,
          status: "ESCALATED",
        }),
        SecurityIncident.countDocuments({
          ...hospital,
          createdAt: { $gte: todayStart, $lte: todayEnd },
        }),
        User.countDocuments({ ...hospital, role: "SECURITY_OFFICER", active: true }),
      ]);

    res.json({
      openIncidents,
      escalatedIncidents,
      incidentsToday,
      officersActive,
    });
  } catch (err) {
    console.error("Security admin dashboard error:", err);
    res.status(500).json({ message: "Failed to load security dashboard" });
  }
}

export async function securityOfficerDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [openIncidents, incidentsToday, escalatedIncidents] = await Promise.all([
      SecurityIncident.countDocuments({
        ...hospital,
        status: { $in: ["OPEN", "INVESTIGATING"] },
      }),
      SecurityIncident.countDocuments({
        ...hospital,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      SecurityIncident.countDocuments({
        ...hospital,
        status: "ESCALATED",
      }),
    ]);

    res.json({
      openIncidents,
      incidentsToday,
      escalatedIncidents,
    });
  } catch (err) {
    console.error("Security officer dashboard error:", err);
    res.status(500).json({ message: "Failed to load security dashboard" });
  }
}

export async function hospitalAdminDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const hospitalId = resolveHospitalScope(req);
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();
    const overdueDate = daysAgo(30);

    const [
      totalStaff,
      doctors,
      nurses,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      appointmentsToday,
      patientsTotal,
      leavePending,
      overtimePending,
      shiftPending,
      invoicesTotal,
      overduePayroll,
      pendingAssignments,
      activeConsultationCalls,
      pharmacists,
      linkedPharmacists,
      unlinkedPharmacists,
      unreadPharmacyRiskNotifications,
      escalationSummary,
      hospitalRecord,
      beds,
      recentBedEvents,
    ] = await Promise.all([
      User.countDocuments({
        ...hospital,
        role: { $nin: ["PATIENT", "GUEST"] },
      }),
      User.countDocuments({ ...hospital, role: "DOCTOR" }),
      User.countDocuments({ ...hospital, role: "NURSE" }),
      User.countDocuments({
        ...hospital,
        role: { $nin: ["PATIENT", "GUEST"] },
        $or: [
          { phone: { $exists: false } },
          { phone: "" },
          { nationalIdNumber: { $exists: false } },
          { nationalIdNumber: "" },
        ],
      }),
      User.countDocuments({
        ...hospital,
        role: { $nin: ["PATIENT", "GUEST"] },
        active: false,
      }),
      User.countDocuments({
        ...hospital,
        role: { $in: LICENSE_ROLES },
        $or: [
          { licenseNumber: { $exists: false } },
          { licenseNumber: "" },
        ],
      }),
      Appointment.countDocuments({
        ...hospital,
        scheduledAt: { $gte: todayStart, $lte: todayEnd },
        status: { $ne: "Cancelled" },
      }),
      Patient.countDocuments(hospital),
      LeaveRequest.countDocuments({ ...hospital, status: "PENDING" }),
      OvertimeRequest.countDocuments({ ...hospital, status: "PENDING" }),
      ShiftRequest.countDocuments({ ...hospital, status: "PENDING" }),
      Invoice.aggregate([
        { $match: { ...hospital, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({
        ...hospital,
        status: "Unpaid",
        createdAt: { $lte: overdueDate },
      }),
      Appointment.countDocuments({
        ...hospital,
        doctor: { $exists: false },
        status: { $nin: ["Cancelled", "Completed", "NoShow"] },
      }),
      CallSession.countDocuments({
        ...hospital,
        deletedAt: { $exists: false },
        status: { $in: ["REQUESTED", "ACTIVE"] },
      }),
      User.countDocuments({ ...hospital, role: "PHARMACIST", active: true }),
      User.countDocuments({
        ...hospital,
        role: "PHARMACIST",
        active: true,
        registeredPharmacy: { $ne: null },
      }),
      User.countDocuments({
        ...hospital,
        role: "PHARMACIST",
        active: true,
        registeredPharmacy: null,
      }),
      Notification.countDocuments({
        hospital: hospitalId || req.user?.hospital || null,
        user: req.user?._id || null,
        category: "PHARMACY",
        read: false,
        "meta.type": "PHARMACY_COVERAGE_RISK",
      }),
      buildEscalationSummary({ hospitalId }),
      hospitalId ? Hospital.findById(hospitalId).select("features").lean() : null,
      Bed.find(hospital).select("ward occupied").lean(),
      AuditLog.find({
        ...hospital,
        action: { $in: ["BED_ASSIGN", "BED_RELEASE", "BED_TRANSFER", "BED_DISCHARGE"] },
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(8)
        .populate("actorId", "name email role")
        .lean(),
    ]);

    const pharmacyFeatureEnabled = Boolean(hospitalRecord?.features?.pharmacy);
    const pharmacyCoverageRisk = pharmacyFeatureEnabled && pharmacists > 0 && linkedPharmacists === 0;
    const pharmacyLinkageWarning = pharmacyFeatureEnabled && unlinkedPharmacists > 0;
    const wardOccupancyMap = new Map();
    for (const bed of beds) {
      const key = bed.ward || "Unassigned";
      const current = wardOccupancyMap.get(key) || { ward: key, total: 0, occupied: 0 };
      current.total += 1;
      if (bed.occupied) current.occupied += 1;
      wardOccupancyMap.set(key, current);
    }
    const wardOccupancy = Array.from(wardOccupancyMap.values())
      .map((row) => ({
        ...row,
        available: Math.max(0, row.total - row.occupied),
        occupancyRate: row.total ? Math.round((row.occupied / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.occupancyRate - a.occupancyRate || a.ward.localeCompare(b.ward))
      .slice(0, 6);
    const occupiedBeds = beds.filter((row) => row.occupied).length;

    res.json({
      totalStaff,
      doctors,
      nurses,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      appointmentsToday,
      patientsTotal,
      pendingRequests: leavePending + overtimePending + shiftPending,
      openShifts: shiftPending,
      pendingAssignments,
      activeConsultationCalls,
      pharmacists,
      linkedPharmacists,
      unlinkedPharmacists,
      unreadPharmacyRiskNotifications,
      escalationSummary,
      pharmacyFeatureEnabled,
      pharmacyCoverageRisk,
      pharmacyLinkageWarning,
      totalBeds: beds.length,
      occupiedBeds,
      bedOccupancyRate: beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0,
      wardOccupancy,
      recentBedEvents: recentBedEvents.map((row) => ({
        _id: row._id,
        action: row.action,
        createdAt: row.createdAt,
        actor: row.actorId
          ? {
              _id: row.actorId._id,
              name: row.actorId.name || row.actorId.email || "Unknown",
              role: row.actorId.role || row.actorRole || "",
            }
          : {
              _id: null,
              name: row.actorRole || "System",
              role: row.actorRole || "",
            },
        metadata: row.metadata || {},
      })),
      invoicesThisMonth: invoicesTotal[0]?.total || 0,
      overduePayroll,
    });
  } catch (err) {
    console.error("Hospital admin dashboard error:", err);
    res.status(500).json({ message: "Failed to load hospital dashboard" });
  }
}

export async function patientDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const userId = req.user._id;
    const todayEnd = endOfDay();
    const patientIds = await resolvePatientIdsForUser(userId, hospital.hospital || null);

    const [
      upcomingAppointments,
      unpaidInvoices,
      prescriptionsActive,
      labResults,
      linkedMinors,
    ] = await Promise.all([
      patientIds.length
        ? Appointment.countDocuments({
            ...hospital,
            patient: { $in: patientIds },
            scheduledAt: { $gt: todayEnd },
            status: { $ne: "Cancelled" },
          })
        : 0,
      Invoice.countDocuments({
        ...hospital,
        patient: userId,
        status: "Unpaid",
      }),
      Prescription.countDocuments({
        ...hospital,
        patient: userId,
        status: { $ne: "CANCELLED" },
      }),
      LabOrder.countDocuments({
        ...hospital,
        patient: userId,
        status: "Completed",
      }),
      buildLinkedMinorSummariesForUser(userId),
    ]);

    res.json({
      upcomingAppointments,
      unpaidInvoices,
      prescriptionsActive,
      labResults,
      familyMonitoring: {
        linkedMinors,
        linkedMinorCount: linkedMinors.length,
      },
    });
  } catch (err) {
    console.error("Patient dashboard error:", err);
    res.status(500).json({ message: "Failed to load patient dashboard" });
  }
}

export async function superAdminDashboard(req, res) {
  try {
    const monthStart = startOfMonth();
    const overdueDate = daysAgo(30);
    const [
      totalHospitals,
      activeHospitals,
      totalUsers,
      totalPatients,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      pendingRequests,
      invoicesThisMonth,
      paymentsThisMonth,
      overduePayroll,
      pharmacists,
      linkedPharmacists,
      unlinkedPharmacists,
      hospitalsWithPharmacists,
    ] = await Promise.all([
      Hospital.countDocuments({}),
      Hospital.countDocuments({ active: true }),
      User.countDocuments({ role: { $ne: "GUEST" } }),
      Patient.countDocuments({}),
      User.countDocuments({
        role: { $nin: ["PATIENT", "GUEST"] },
        $or: [
          { phone: { $exists: false } },
          { phone: "" },
          { nationalIdNumber: { $exists: false } },
          { nationalIdNumber: "" },
        ],
      }),
      User.countDocuments({
        role: { $nin: ["PATIENT", "GUEST"] },
        active: false,
      }),
      User.countDocuments({
        role: { $in: LICENSE_ROLES },
        $or: [
          { licenseNumber: { $exists: false } },
          { licenseNumber: "" },
        ],
      }),
      Promise.all([
        LeaveRequest.countDocuments({ status: "PENDING" }),
        OvertimeRequest.countDocuments({ status: "PENDING" }),
        ShiftRequest.countDocuments({ status: "PENDING" }),
      ]),
      Invoice.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        { $match: { status: "Paid", paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({
        status: "Unpaid",
        createdAt: { $lte: overdueDate },
      }),
      User.countDocuments({ role: "PHARMACIST", active: true }),
      User.countDocuments({
        role: "PHARMACIST",
        active: true,
        registeredPharmacy: { $ne: null },
      }),
      User.countDocuments({
        role: "PHARMACIST",
        active: true,
        registeredPharmacy: null,
      }),
      User.distinct("hospital", {
        role: "PHARMACIST",
        active: true,
        hospital: { $ne: null },
      }).then((rows) => rows.filter(Boolean).length),
    ]);

    const [leavePending, overtimePending, shiftPending] = pendingRequests;

    res.json({
      totalHospitals,
      activeHospitals,
      totalUsers,
      totalPatients,
      incompleteStaff,
      inactiveStaff,
      missingLicenses,
      pendingRequests: leavePending + overtimePending + shiftPending,
      invoicesThisMonth: invoicesThisMonth[0]?.total || 0,
      paymentsThisMonth: paymentsThisMonth[0]?.total || 0,
      overduePayroll,
      pharmacists,
      linkedPharmacists,
      unlinkedPharmacists,
      hospitalsWithPharmacists,
    });
  } catch (err) {
    console.error("Super admin dashboard error:", err);
    res.status(500).json({ message: "Failed to load super admin dashboard" });
  }
}

export async function communityHealthWorkerDashboard(req, res) {
  try {
    const hospital = hospitalFilter(req);
    const chw = req.user._id;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [
      householdsAssigned,
      visitsToday,
      vaccinationsDue,
      highRiskPatients,
      referralsPending,
      diseaseAlerts,
    ] = await Promise.all([
      Household.countDocuments({ ...hospital, chw, active: true }),
      FieldVisit.countDocuments({
        ...hospital,
        chw,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      VaccinationRecord.countDocuments({
        ...hospital,
        chw,
        administeredAt: { $gte: todayStart, $lte: todayEnd },
      }),
      MaternalRecord.countDocuments({
        ...hospital,
        chw,
        highRiskPregnancy: true,
      }),
      ChwReferral.countDocuments({
        ...hospital,
        chw,
        status: "PENDING",
      }),
      DiseaseReport.countDocuments({
        ...hospital,
        chw,
        severity: { $in: ["HIGH", "CRITICAL"] },
        createdAt: { $gte: todayStart },
      }),
    ]);

    return res.json({
      householdsAssigned,
      visitsToday,
      vaccinationsDue,
      highRiskPatients,
      referralsPending,
      diseaseAlerts,
    });
  } catch (err) {
    console.error("CHW dashboard error:", err);
    return res.status(500).json({ message: "Failed to load CHW dashboard" });
  }
}

export async function getDashboardActionMatrix(req, res) {
  return res.json({
    generatedAt: new Date().toISOString(),
    total: DASHBOARD_ACTION_MATRIX.length,
    matrix: DASHBOARD_ACTION_MATRIX,
  });
}

export async function exportDashboardActionMatrixCsv(_req, res) {
  const rows = [
    ["dashboard", "route", "action", "target", "expectedResult"],
    ...DASHBOARD_ACTION_MATRIX.map((row) => [
      JSON.stringify(row.dashboard),
      JSON.stringify(row.route),
      JSON.stringify(row.action),
      JSON.stringify(row.target),
      JSON.stringify(row.expectedResult),
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=dashboard-action-matrix.csv");
  return res.status(200).send(csv);
}
