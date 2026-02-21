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
import Hospital from "../models/Hospital.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const LICENSE_ROLES = [
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
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
    ]);

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

    const [
      upcomingAppointments,
      unpaidInvoices,
      prescriptionsActive,
      labResults,
    ] = await Promise.all([
      Appointment.countDocuments({
        ...hospital,
        patient: userId,
        scheduledAt: { $gt: todayEnd },
        status: { $ne: "Cancelled" },
      }),
      Invoice.countDocuments({
        ...hospital,
        patient: userId,
        status: "Unpaid",
      }),
      Prescription.countDocuments({
        ...hospital,
        patient: userId,
        status: { $ne: "Cancelled" },
      }),
      LabOrder.countDocuments({
        ...hospital,
        patient: userId,
        status: "Completed",
      }),
    ]);

    res.json({
      upcomingAppointments,
      unpaidInvoices,
      prescriptionsActive,
      labResults,
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
    });
  } catch (err) {
    console.error("Super admin dashboard error:", err);
    res.status(500).json({ message: "Failed to load super admin dashboard" });
  }
}
