import "./theme-d.css";
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "./utils/auth";
import apiFetch from "./utils/apiFetch";
import SocketProvider from "./utils/socket";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import FloatingAI from "./components/FloatingAI";
import FirstLoginTour from "./components/FirstLoginTour";
import RequireRole from "./components/RequireRole";
import AutoRedirect from "./components/AutoRedirect";

/* =======================
   PUBLIC / AUTH
======================= */
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import VerifySuccess from "./pages/VerifySuccess";
import Unauthorized from "./pages/Unauthorized";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TwoFactor from "./pages/TwoFactor";
import StepUp from "./pages/StepUp";
import GuestDashboard from "./pages/GuestDashboard";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics/Index";
import Reports from "./pages/Reports/Index";
import Inventory from "./pages/Inventory/Index";
import PaymentsPage from "./pages/Payments/PaymentsPage";
import PaymentsPageFull from "./pages/Payments/PaymentsFull";
import MedicalAssistant from "./pages/AI/MedicalAssistant";
import Triage from "./pages/AI/Triage";
import VoiceDictation from "./pages/AI/VoiceDictation";
import Chatbot from "./pages/AI/Chatbot";
import NeuroEdgeExtract from "./pages/AI/NeuroEdgeExtract";
import AIChatWS from "./components/AIChatWS";
import DoctorAppointments from "./pages/Doctor/Appointments";
import MySchedule from "./pages/Doctor/MySchedule";
import MyPatients from "./pages/Doctor/MyPatients";
import OPDWorkspace from "./pages/Doctor/OPDWorkspace";
import InpatientWard from "./pages/Doctor/InpatientWard";
import SurgeryProcedures from "./pages/Doctor/SurgeryProcedures";
import LabResults from "./pages/Doctor/LabResults";
import Prescriptions from "./pages/Doctor/Prescriptions";
import MedicalRecords from "./pages/Doctor/MedicalRecords";
import Referrals from "./pages/Doctor/Referrals";
import DoctorPerformance from "./pages/Doctor/Performance";
import CMECertifications from "./pages/Doctor/CMECertifications";
import DoctorLeaveRequests from "./pages/Doctor/LeaveRequests";
import DoctorReportsNotes from "./pages/Doctor/ReportsNotes";
import DoctorSettings from "./pages/Doctor/DoctorSettings";
import LabTests from "./pages/LabTech/LabTests";
import NurseMyShift from "./pages/Nurse/MyShift";
import NurseAssignedPatients from "./pages/Nurse/AssignedPatients";
import NurseMedicationAdministration from "./pages/Nurse/MedicationAdministration";
import NurseIncidentReports from "./pages/Nurse/IncidentReports";
import NurseVitalsEntry from "./pages/Nurse/VitalsEntry";
import NurseLeaveRequests from "./pages/Nurse/LeaveRequests";
import NursePerformance from "./pages/Nurse/Performance";
import LabTestQueue from "./pages/LabTech/TestQueue";
import LabEquipmentLogs from "./pages/LabTech/EquipmentLogs";
import LabSampleTracking from "./pages/LabTech/SampleTracking";
import LabQualityControl from "./pages/LabTech/QualityControl";
import LabSafetyChecklist from "./pages/LabTech/SafetyChecklist";
import LabReportsArchive from "./pages/LabTech/ReportsArchive";
import PharmacyQueue from "./pages/Pharmacy/PrescriptionQueue";
import PharmacyInventory from "./pages/Pharmacy/InventoryPage";
import PharmacyControlled from "./pages/Pharmacy/ControlledDrugs";
import PharmacyExpiry from "./pages/Pharmacy/ExpiryAlerts";
import PharmacySuppliers from "./pages/Pharmacy/SupplierOrders";
import PharmacyReports from "./pages/Pharmacy/ReportsPage";
import PatientAppointments from "./pages/Patient/MyAppointments";
import PatientMedicalRecords from "./pages/Patient/MedicalRecords";
import PatientPrescriptions from "./pages/Patient/Prescriptions";
import PatientLabResults from "./pages/Patient/LabResults";
import PatientBilling from "./pages/Patient/Billing";
import PatientInsurance from "./pages/Patient/Insurance";
import PatientFeedback from "./pages/Patient/Feedback";
import RealTimeIntegrations from "./pages/Admin/RealTimeIntegrations";
import CRDTPatientEditor from "./pages/Admin/CRDTPatientEditor";
import NotificationsPage from "./pages/Admin/NotificationsPage";
import PaymentSettings from "./pages/Admin/PaymentSettings";

/* =======================
   DASHBOARDS
======================= */
import DoctorDashboard from "./pages/Doctor/Dashboard";
import PatientDashboard from "./pages/Patient/Dashboard";
import NurseDashboard from "./pages/Nurse/Dashboard";
import LabTechDashboard from "./pages/LabTech/Dashboard";
import PharmacyDashboard from "./pages/Pharmacy/Index";
import SuperAdminDashboard from "./pages/SuperAdmin/Dashboard";
import SuperAdminHospitals from "./pages/SuperAdmin/Hospitals";
import SuperAdminSystemSettings from "./pages/SuperAdmin/SystemSettings";
import HospitalAdminDashboard from "./pages/HospitalAdmin/Dashboard";
import HospitalAdminRegisterStaff from "./pages/HospitalAdmin/RegisterStaff";
import HospitalAdminApprovals from "./pages/HospitalAdmin/Approvals";
import HospitalAdminStaffManagement from "./pages/HospitalAdmin/StaffManagement";
import SecurityOfficerDashboard from "./pages/Security/OfficerDashboard";
import SecurityAdminDashboard from "./pages/Security/AdminDashboard";
import StaffDashboard from "./pages/Staff/Dashboard";
import HRManagerDashboard from "./pages/HRManager/Dashboard";
import PayrollOfficerDashboard from "./pages/PayrollOfficer/Dashboard";
import DeveloperDashboard from "./pages/Developer/Dashboard";
import SystemAdminDashboard from "./pages/SystemAdmin/Dashboard";
import AbacPolicies from "./pages/SystemAdmin/AbacPolicies";
import MappingStudio from "./pages/SystemAdmin/MappingStudio";
import NlpAnalytics from "./pages/SystemAdmin/NlpAnalytics";
import RegulatoryReports from "./pages/SystemAdmin/RegulatoryReports";
import ClinicalIntelligence from "./pages/SystemAdmin/ClinicalIntelligence";
import MyRequests from "./pages/Workforce/MyRequests";
import QueueReplay from "./pages/Developer/QueueReplay";
import WebhookRetry from "./pages/Developer/WebhookRetry";
import DecisionCockpit from "./pages/Developer/DecisionCockpit";
import ProvenanceVerify from "./pages/Developer/ProvenanceVerify";
import AIExtractionHistory from "./pages/Developer/AIExtractionHistory";

/* =======================
   ADMIN
======================= */
import AdminDashboard from "./pages/Admin/Dashboard";
import AuditLogs from "./pages/Admin/AuditLogs";
import CreateAdmin from "./pages/Admin/CreateAdmin";

/* =====================================================
   APP LAYOUT (PROTECTED)
===================================================== */
function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [securityNotice, setSecurityNotice] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_reminders") || "[]");
    } catch {
      return [];
    }
  });

  const roleDashboardEndpoint = (role) => {
    switch (role) {
      case "DOCTOR":
        return "/api/dashboard/doctor";
      case "NURSE":
        return "/api/dashboard/nurse";
      case "LAB_TECH":
        return "/api/dashboard/lab-tech";
      case "HR_MANAGER":
        return "/api/dashboard/hr";
      case "PAYROLL_OFFICER":
        return "/api/dashboard/payroll";
      case "HOSPITAL_ADMIN":
        return "/api/dashboard/hospital-admin";
      case "SECURITY_ADMIN":
        return "/api/dashboard/security-admin";
      case "SECURITY_OFFICER":
        return "/api/dashboard/security-officer";
      case "PATIENT":
        return "/api/dashboard/patient";
      case "SUPER_ADMIN":
        return "/api/dashboard/super-admin";
      case "RADIOLOGIST":
      case "THERAPIST":
      case "RECEPTIONIST":
        return "/api/dashboard/staff";
      default:
        return null;
    }
  };

  useEffect(() => {
    const onSecurity = (event) => {
      const detail = event?.detail || {};
      setSecurityNotice({
        code: detail.code || "SESSION_SECURITY",
        message: detail.message || "Additional verification is required.",
      });
      navigate("/step-up");
    };
    window.addEventListener("afyalink:session-security", onSecurity);
    return () => {
      window.removeEventListener("afyalink:session-security", onSecurity);
    };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    apiFetch("/api/auth/session-risk")
      .then((sr) => {
        if (!mounted || !sr) return;
        if (sr.restriction || sr.requiresStepUp) {
          setSecurityNotice({
            code: sr.restriction ? "SESSION_RESTRICTED" : "STEP_UP_REQUIRED",
            message:
              sr.restriction?.reason === "CRITICAL_LOGIN_RISK"
                ? "Your session is temporarily restricted due to critical login risk. Verify step-up to unlock."
                : "Step-up verification is required for sensitive actions.",
          });
          setReminders((prev) => {
            const without = (prev || []).filter((r) => r.id !== "session-stepup");
            return [
              {
                id: "session-stepup",
                text:
                  sr.restriction?.reason === "CRITICAL_LOGIN_RISK"
                    ? "Session restricted. Click to complete step-up verification."
                    : "Sensitive actions require step-up verification. Click to verify.",
                action: () => navigate("/step-up"),
              },
              ...without,
            ];
          });
        } else {
          setSecurityNotice(null);
        }
      })
      .catch(() => {});

    const dashEndpoint = roleDashboardEndpoint(user?.role);
    const dashPromise = dashEndpoint ? apiFetch(dashEndpoint) : Promise.resolve(null);
    Promise.all([apiFetch("/api/profile"), apiFetch("/api/2fa/status"), dashPromise])
      .then(([me, twofa, dash]) => {
        if (!mounted) return;
        const list = [];

        if (!me?.emailVerified) {
          list.push({
            id: "email",
            text:
              me?.verificationWarning?.message ||
              "Your email is not verified. Click to verify in Profile.",
            action: () => navigate("/profile"),
          });
        }
        if (!me?.phoneVerified) {
          list.push({
            id: "phone",
            text: "Verify your phone number to secure your account.",
            action: () => navigate("/profile"),
          });
        }
        if (!me?.nationalIdNumber || !me?.nationalIdCountry) {
          list.push({
            id: "id",
            text: "Add your National ID details to complete your profile.",
            action: () => navigate("/profile"),
          });
        }
        if (!twofa?.enabled) {
          list.push({
            id: "2fa",
            text: "Enable two-factor authentication for stronger security.",
            action: () => navigate("/profile"),
          });
        }

        if (dash) {
          const role = user?.role;

          if (dash.pendingRequests?.total > 0) {
            list.push({
              id: "pending-requests",
              text: `You have ${dash.pendingRequests.total} pending requests.`,
              action: () =>
                navigate(role === "HOSPITAL_ADMIN" ? "/hospital-admin/approvals" : "/workforce/requests"),
            });
          }

          if (role === "HOSPITAL_ADMIN" && dash.pendingRequests > 0) {
            list.push({
              id: "pending-approvals",
              text: `You have ${dash.pendingRequests} approvals waiting.`,
              action: () => navigate("/hospital-admin/approvals"),
            });
          }

          if (role === "HR_MANAGER" && dash.pendingRequests?.total > 0) {
            list.push({
              id: "hr-requests",
              text: `Workforce requests pending: ${dash.pendingRequests.total}.`,
              action: () => navigate("/hr-manager"),
            });
          }

          if (role === "PAYROLL_OFFICER" && dash.pendingApprovals > 0) {
            list.push({
              id: "payroll-approvals",
              text: `Payroll approvals pending: ${dash.pendingApprovals}.`,
              action: () => navigate("/payroll-officer"),
            });
          }

          if (
            (role === "PAYROLL_OFFICER" || role === "HOSPITAL_ADMIN" || role === "SUPER_ADMIN") &&
            dash.overduePayroll > 0
          ) {
            list.push({
              id: "overdue-payroll",
              text: `Overdue payroll items: ${dash.overduePayroll}.`,
              action: () => navigate(role === "PAYROLL_OFFICER" ? "/payroll-officer" : "/payments"),
            });
          }

          if (role === "SUPER_ADMIN" && dash.pendingRequests > 0) {
            list.push({
              id: "super-pending",
              text: `Global approvals pending: ${dash.pendingRequests}.`,
              action: () => navigate("/admin/notifications"),
            });
          }

          if (
            (role === "HOSPITAL_ADMIN" || role === "HR_MANAGER" || role === "SUPER_ADMIN") &&
            dash.incompleteStaff > 0
          ) {
            list.push({
              id: "incomplete-staff",
              text: `${dash.incompleteStaff} staff records are incomplete.`,
              action: () =>
                navigate(
                  role === "SUPER_ADMIN"
                    ? "/super-admin"
                    : role === "HR_MANAGER"
                    ? "/hr-manager"
                    : "/hospital-admin/staff"
                ),
            });
          }

          if (
            (role === "HOSPITAL_ADMIN" || role === "HR_MANAGER" || role === "SUPER_ADMIN") &&
            dash.inactiveStaff > 0
          ) {
            list.push({
              id: "inactive-staff",
              text: `${dash.inactiveStaff} staff accounts are inactive.`,
              action: () =>
                navigate(
                  role === "SUPER_ADMIN"
                    ? "/super-admin"
                    : role === "HR_MANAGER"
                    ? "/hr-manager"
                    : "/hospital-admin/staff"
                ),
            });
          }

          if (
            (role === "HOSPITAL_ADMIN" || role === "HR_MANAGER" || role === "SUPER_ADMIN") &&
            dash.missingLicenses > 0
          ) {
            list.push({
              id: "missing-licenses",
              text: `${dash.missingLicenses} staff are missing license details.`,
              action: () =>
                navigate(
                  role === "SUPER_ADMIN"
                    ? "/super-admin"
                    : role === "HR_MANAGER"
                    ? "/hr-manager"
                    : "/hospital-admin/staff"
                ),
            });
          }

          if (
            ["RADIOLOGIST", "THERAPIST", "RECEPTIONIST"].includes(role) &&
            dash.myPendingRequests > 0
          ) {
            list.push({
              id: "my-requests",
              text: `You have ${dash.myPendingRequests} pending requests.`,
              action: () => navigate("/workforce/requests"),
            });
          }

          if (dash.notificationsUnread > 0) {
            list.push({
              id: "unread-notifs",
              text: `You have ${dash.notificationsUnread} unread notifications.`,
              action: () =>
                navigate(
                  ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"].includes(role)
                    ? "/admin/notifications"
                    : "/profile"
                ),
            });
          }

          if (role === "LAB_TECH" && dash.pendingOrders > 0) {
            list.push({
              id: "lab-orders",
              text: `${dash.pendingOrders} lab orders are pending.`,
              action: () => navigate("/lab-tech"),
            });
          }

          if (role === "NURSE" && dash.pendingLabOrders > 0) {
            list.push({
              id: "lab-pending",
              text: `${dash.pendingLabOrders} lab orders are pending.`,
              action: () => navigate("/nurse"),
            });
          }

          if (role === "DOCTOR" && dash.upcomingAppointments > 0) {
            list.push({
              id: "doctor-appts",
              text: `${dash.upcomingAppointments} upcoming appointments.`,
              action: () => navigate("/doctor/appointments"),
            });
          }

          if (role === "PATIENT") {
            if (dash.upcomingAppointments > 0) {
              list.push({
                id: "patient-appts",
                text: `${dash.upcomingAppointments} upcoming appointments.`,
                action: () => navigate("/patient"),
              });
            }
            if (dash.unpaidInvoices > 0) {
              list.push({
                id: "patient-invoices",
                text: `${dash.unpaidInvoices} unpaid invoices.`,
                action: () => navigate("/payments"),
              });
            }
          }

          if ((role === "SECURITY_ADMIN" || role === "SECURITY_OFFICER") && dash.openIncidents > 0) {
            list.push({
              id: "security-incidents",
              text: `${dash.openIncidents} security incidents are open.`,
              action: () => navigate(role === "SECURITY_ADMIN" ? "/security-admin" : "/security-officer"),
            });
          }
        }

        setReminders(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const dismissReminder = (id) => {
    const next = Array.from(new Set([...(dismissed || []), id]));
    setDismissed(next);
    localStorage.setItem("dismissed_reminders", JSON.stringify(next));
  };

  return (
    <>
      {user && (
        <Navbar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      )}
      {user && sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigator"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`app-grid ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        {user && <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <main className="main">
          {securityNotice && (
            <button className="verify-banner" onClick={() => navigate("/step-up")}>
              {securityNotice.message}
              <span
                className="banner-close"
                role="button"
                aria-label="Dismiss notice"
                onClick={(e) => {
                  e.stopPropagation();
                  setSecurityNotice(null);
                }}
              >
                ×
              </span>
            </button>
          )}
          {reminders
            .filter((r) => !dismissed.includes(r.id))
            .map((r) => (
            <button
              key={r.id}
              className="verify-banner"
              onClick={r.action}
            >
              {r.text}
              <span
                className="banner-close"
                role="button"
                aria-label="Dismiss reminder"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissReminder(r.id);
                }}
              >
                ×
              </span>
            </button>
          ))}
          <Outlet />
        </main>
      </div>
      {user && <FirstLoginTour />}
      {user && <FloatingAI />}
    </>
  );
}

/* =====================================================
   APP
===================================================== */
export default function App() {
  return (
    <SocketProvider>
      <Routes>
        {/* ============ PUBLIC ROUTES ============ */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-success" element={<VerifySuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/2fa" element={<TwoFactor />} />
        <Route path="/step-up" element={<StepUp />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/403" element={<Unauthorized />} />

        {/* ============ PROTECTED ROUTES ============ */}
        <Route
          element={
            <RequireRole>
              <AutoRedirect>
                <AppLayout />
              </AutoRedirect>
            </RequireRole>
          }
        >
          {/* PATIENT */}
          <Route
            path="/patient"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientAppointments />
              </RequireRole>
            }
          />
          <Route
            path="/patient/medical-records"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientMedicalRecords />
              </RequireRole>
            }
          />
          <Route
            path="/patient/prescriptions"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientPrescriptions />
              </RequireRole>
            }
          />
          <Route
            path="/patient/lab-results"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientLabResults />
              </RequireRole>
            }
          />
          <Route
            path="/patient/billing"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientBilling />
              </RequireRole>
            }
          />
          <Route
            path="/patient/insurance"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientInsurance />
              </RequireRole>
            }
          />
          <Route
            path="/patient/feedback"
            element={
              <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientFeedback />
              </RequireRole>
            }
          />

          {/* DOCTOR */}
          <Route
            path="/doctor"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorDashboard />
              </RequireRole>
            }
          />

          {/* NURSE */}
          <Route
            path="/nurse"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/shift"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseMyShift />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/patients"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseAssignedPatients />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/medication"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseMedicationAdministration />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/incidents"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseIncidentReports />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/vitals"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseVitalsEntry />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/leave"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NurseLeaveRequests />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/performance"
            element={
              <RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}>
                <NursePerformance />
              </RequireRole>
            }
          />

          {/* LAB TECH */}
          <Route
            path="/lab-tech"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabTechDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/test-queue"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabTestQueue />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/equipment"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabEquipmentLogs />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/samples"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabSampleTracking />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/qc"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabQualityControl />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/safety"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabSafetyChecklist />
              </RequireRole>
            }
          />
          <Route
            path="/lab-tech/archive"
            element={
              <RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabReportsArchive />
              </RequireRole>
            }
          />

          {/* PHARMACIST */}
          <Route
            path="/pharmacy"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/queue"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyQueue />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/inventory"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyInventory />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/controlled"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyControlled />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/expiry"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyExpiry />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/suppliers"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacySuppliers />
              </RequireRole>
            }
          />
          <Route
            path="/pharmacy/reports"
            element={
              <RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyReports />
              </RequireRole>
            }
          />

          {/* GENERIC STAFF */}
          <Route
            path="/staff"
            element={
              <RequireRole
                roles={[
                  "RADIOLOGIST",
                  "THERAPIST",
                  "RECEPTIONIST",
                  "SUPER_ADMIN",
                  "DEVELOPER",
                ]}
              >
                <StaffDashboard />
              </RequireRole>
            }
          />

          {/* HR MANAGER */}
          <Route
            path="/hr-manager"
            element={
              <RequireRole roles={["HR_MANAGER", "SUPER_ADMIN", "DEVELOPER"]}>
                <HRManagerDashboard />
              </RequireRole>
            }
          />

          {/* PAYROLL OFFICER */}
          <Route
            path="/payroll-officer"
            element={
              <RequireRole roles={["PAYROLL_OFFICER", "SUPER_ADMIN", "DEVELOPER"]}>
                <PayrollOfficerDashboard />
              </RequireRole>
            }
          />

          {/* DEVELOPER */}
          <Route
            path="/developer"
            element={
              <RequireRole roles={["DEVELOPER"]}>
                <DeveloperDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/developer/queue-replay"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN"]}>
                <QueueReplay />
              </RequireRole>
            }
          />
          <Route
            path="/developer/webhook-retry"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN"]}>
                <WebhookRetry />
              </RequireRole>
            }
          />
          <Route
            path="/developer/decision-cockpit"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                <DecisionCockpit />
              </RequireRole>
            }
          />
          <Route
            path="/developer/provenance-verify"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                <ProvenanceVerify />
              </RequireRole>
            }
          />
          <Route
            path="/developer/ai-extraction-history"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                <AIExtractionHistory />
              </RequireRole>
            }
          />

          {/* SUPER ADMIN */}
          <Route
            path="/super-admin"
            element={
              <RequireRole roles={["SUPER_ADMIN"]}>
                <SuperAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/super-admin/hospitals"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                <SuperAdminHospitals />
              </RequireRole>
            }
          />
          <Route
            path="/super-admin/settings"
            element={
              <RequireRole roles={["SUPER_ADMIN", "DEVELOPER"]}>
                <SuperAdminSystemSettings />
              </RequireRole>
            }
          />

          {/* SYSTEM ADMIN */}
          <Route
            path="/system-admin"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <SystemAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/abac"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <AbacPolicies />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/mapping-studio"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <MappingStudio />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/nlp-analytics"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"]}>
                <NlpAnalytics />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/regulatory-reports"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}>
                <RegulatoryReports />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/clinical-intelligence"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "DOCTOR", "NURSE"]}>
                <ClinicalIntelligence />
              </RequireRole>
            }
          />

          {/* HOSPITAL ADMIN */}
          <Route
            path="/hospital-admin"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/register-staff"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN"]}>
                <HospitalAdminRegisterStaff />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/approvals"
            element={
              <RequireRole
                roles={["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}
              >
                <HospitalAdminApprovals />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/staff"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SUPER_ADMIN"]}>
                <HospitalAdminStaffManagement />
              </RequireRole>
            }
          />

          {/* SECURITY */}
          <Route
            path="/security-officer"
            element={
              <RequireRole roles={["SECURITY_OFFICER", "SUPER_ADMIN", "DEVELOPER"]}>
                <SecurityOfficerDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/security-admin"
            element={
              <RequireRole roles={["SECURITY_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <SecurityAdminDashboard />
              </RequireRole>
            }
          />

          {/* GUEST */}
          <Route
            path="/guest"
            element={
              <RequireRole roles={["GUEST"]}>
                <GuestDashboard />
              </RequireRole>
            }
          />

          {/* ADMIN TOOLS */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"]}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="realtime" element={<RealTimeIntegrations />} />
            <Route path="crdt-patients" element={<CRDTPatientEditor />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="payment-settings"
              element={
                <RequireRole roles={["SUPER_ADMIN"]}>
                  <PaymentSettings />
                </RequireRole>
              }
            />
            <Route
              path="create-admin"
              element={
                <RequireRole roles={["SUPER_ADMIN"]}>
                  <CreateAdmin />
                </RequireRole>
              }
            />
          </Route>

          {/* SHARED PAGES */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/full" element={<PaymentsPageFull />} />

          {/* AI */}
          <Route path="/ai/medical" element={<MedicalAssistant />} />
          <Route path="/ai/triage" element={<Triage />} />
          <Route path="/ai/voice" element={<VoiceDictation />} />
          <Route path="/ai/chatbot" element={<Chatbot />} />
          <Route path="/ai/extract" element={<NeuroEdgeExtract />} />
          <Route path="/ai/ws" element={<AIChatWS />} />

          {/* ROLE-SCOPED PAGES */}
          <Route
            path="/workforce/requests"
            element={
              <RequireRole
                roles={[
                  "HOSPITAL_ADMIN",
                  "HR_MANAGER",
                  "PAYROLL_OFFICER",
                  "DOCTOR",
                  "NURSE",
                  "LAB_TECH",
                  "PHARMACIST",
                  "RADIOLOGIST",
                  "THERAPIST",
                  "RECEPTIONIST",
                  "SECURITY_ADMIN",
                  "SECURITY_OFFICER",
                ]}
              >
                <MyRequests />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/appointments"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorAppointments />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/schedule"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <MySchedule />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <MyPatients />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/opd"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <OPDWorkspace />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/ward"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <InpatientWard />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/surgery"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <SurgeryProcedures />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/lab-results"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabResults />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/prescriptions"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <Prescriptions />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/medical-records"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <MedicalRecords />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/referrals"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <Referrals />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/performance"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorPerformance />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/cme"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <CMECertifications />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/leave"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorLeaveRequests />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/reports-notes"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorReportsNotes />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/settings"
            element={
              <RequireRole roles={["DOCTOR", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorSettings />
              </RequireRole>
            }
          />
          <Route
            path="/labtech/labs"
            element={
              <RequireRole roles={["LAB_TECH"]}>
                <LabTests />
              </RequireRole>
            }
          />

          {/* Legacy aliases */}
          <Route path="/superadmin" element={<Navigate to="/super-admin" replace />} />
          <Route path="/hospitaladmin" element={<Navigate to="/hospital-admin" replace />} />
        </Route>

        {/* ============ 404 ============ */}
        <Route path="*" element={<div>404 — Page not found</div>} />
      </Routes>
    </SocketProvider>
  );
}
