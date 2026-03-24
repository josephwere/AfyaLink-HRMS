import "./theme-d.css";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "./utils/auth";
import apiFetch from "./utils/apiFetch";
import SocketProvider from "./utils/socket";
import { redirectByRole } from "./utils/redirectByRole";
import { useSystemSettings } from "./utils/systemSettings.jsx";
import { applyAccessibilityPrefs, loadAccessibilityPrefs } from "./utils/accessibilityPrefs";
import { prefetchRoutesForRole } from "./utils/routePrefetch";
import { PatientLanguageProvider } from "./utils/patientLanguage.jsx";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import FloatingAI from "./components/FloatingAI";
import FirstLoginTour from "./components/FirstLoginTour";
import RequireRole from "./components/RequireRole";
import AutoRedirect from "./components/AutoRedirect";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { refreshOfflineMetricsSnapshot, startOfflineAutoSync } from "./utils/offlineQueue";
import { pushOfflineClientMetrics } from "./services/offlineOpsApi";

/* =======================
   PUBLIC / AUTH
======================= */
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const VerifySuccess = lazy(() => import("./pages/VerifySuccess"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CareersLanding = lazy(() => import("./pages/CareersLanding"));
const TermsOfService = lazy(() => import("./pages/Legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/Legal/PrivacyPolicy"));
const TwoFactor = lazy(() => import("./pages/TwoFactor"));
const StepUp = lazy(() => import("./pages/StepUp"));
const GuestDashboard = lazy(() => import("./pages/GuestDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Analytics = lazy(() => import("./pages/Analytics/Index"));
const Reports = lazy(() => import("./pages/Reports/Index"));
const Inventory = lazy(() => import("./pages/Inventory/Index"));
const PaymentsPage = lazy(() => import("./pages/Payments/PaymentsPage"));
const PaymentsPageFull = lazy(() => import("./pages/Payments/PaymentsFull"));
const MedicalAssistant = lazy(() => import("./pages/AI/MedicalAssistant"));
const Triage = lazy(() => import("./pages/AI/Triage"));
const VoiceDictation = lazy(() => import("./pages/AI/VoiceDictation"));
const Chatbot = lazy(() => import("./pages/AI/Chatbot"));
const NeuroEdgeExtract = lazy(() => import("./pages/AI/NeuroEdgeExtract"));
const AIChatWS = lazy(() => import("./components/AIChatWS"));
const DoctorAppointments = lazy(() => import("./pages/Doctor/Appointments"));
const DoctorTransfers = lazy(() => import("./pages/Doctor/Transfers"));
const MySchedule = lazy(() => import("./pages/Doctor/MySchedule"));
const MyPatients = lazy(() => import("./pages/Doctor/MyPatients"));
const OPDWorkspace = lazy(() => import("./pages/Doctor/OPDWorkspace"));
const InpatientWard = lazy(() => import("./pages/Doctor/InpatientWard"));
const SurgeryProcedures = lazy(() => import("./pages/Doctor/SurgeryProcedures"));
const LabResults = lazy(() => import("./pages/Doctor/LabResults"));
const Prescriptions = lazy(() => import("./pages/Doctor/Prescriptions"));
const MedicalRecords = lazy(() => import("./pages/Doctor/MedicalRecords"));
const Referrals = lazy(() => import("./pages/Doctor/Referrals"));
const DoctorPerformance = lazy(() => import("./pages/Doctor/Performance"));
const CMECertifications = lazy(() => import("./pages/Doctor/CMECertifications"));
const DoctorLeaveRequests = lazy(() => import("./pages/Doctor/LeaveRequests"));
const DoctorReportsNotes = lazy(() => import("./pages/Doctor/ReportsNotes"));
const DoctorSettings = lazy(() => import("./pages/Doctor/DoctorSettings"));
const LabTests = lazy(() => import("./pages/LabTech/LabTests"));
const NurseMyShift = lazy(() => import("./pages/Nurse/MyShift"));
const NurseAssignedPatients = lazy(() => import("./pages/Nurse/AssignedPatients"));
const NurseMedicationAdministration = lazy(() => import("./pages/Nurse/MedicationAdministration"));
const NurseIncidentReports = lazy(() => import("./pages/Nurse/IncidentReports"));
const NurseVitalsEntry = lazy(() => import("./pages/Nurse/VitalsEntry"));
const NurseLeaveRequests = lazy(() => import("./pages/Nurse/LeaveRequests"));
const NursePerformance = lazy(() => import("./pages/Nurse/Performance"));
const LabTestQueue = lazy(() => import("./pages/LabTech/TestQueue"));
const LabEquipmentLogs = lazy(() => import("./pages/LabTech/EquipmentLogs"));
const LabSampleTracking = lazy(() => import("./pages/LabTech/SampleTracking"));
const LabQualityControl = lazy(() => import("./pages/LabTech/QualityControl"));
const LabSafetyChecklist = lazy(() => import("./pages/LabTech/SafetyChecklist"));
const LabReportsArchive = lazy(() => import("./pages/LabTech/ReportsArchive"));
const PharmacyQueue = lazy(() => import("./pages/Pharmacy/PrescriptionQueue"));
const PharmacyInventory = lazy(() => import("./pages/Pharmacy/InventoryPage"));
const PharmacyControlled = lazy(() => import("./pages/Pharmacy/ControlledDrugs"));
const PharmacyExpiry = lazy(() => import("./pages/Pharmacy/ExpiryAlerts"));
const PharmacySuppliers = lazy(() => import("./pages/Pharmacy/SupplierOrders"));
const PharmacyReports = lazy(() => import("./pages/Pharmacy/ReportsPage"));
const PatientAppointments = lazy(() => import("./pages/Patient/MyAppointments"));
const PatientMedicalRecords = lazy(() => import("./pages/Patient/MedicalRecords"));
const PatientFamilyRecords = lazy(() => import("./pages/Patient/FamilyRecords"));
const PatientFamilyTimeline = lazy(() => import("./pages/Patient/FamilyTimeline"));
const PatientPrescriptions = lazy(() => import("./pages/Patient/Prescriptions"));
const PatientLabResults = lazy(() => import("./pages/Patient/LabResults"));
const PatientBilling = lazy(() => import("./pages/Patient/Billing"));
const PatientInsurance = lazy(() => import("./pages/Patient/Insurance"));
const PatientTransfers = lazy(() => import("./pages/Patient/Transfers"));
const PatientFeedback = lazy(() => import("./pages/Patient/Feedback"));
const PatientHospitals = lazy(() => import("./pages/Patient/Hospitals"));
const PatientAdsFeed = lazy(() => import("./pages/Patient/AdsFeed"));
const RealTimeIntegrations = lazy(() => import("./pages/Admin/RealTimeIntegrations"));
const CRDTPatientEditor = lazy(() => import("./pages/Admin/CRDTPatientEditor"));
const NotificationsPage = lazy(() => import("./pages/Admin/NotificationsPage"));
const PaymentSettings = lazy(() => import("./pages/Admin/PaymentSettings"));
const AccessControl = lazy(() => import("./pages/Admin/AccessControl"));
const PrintCenter = lazy(() => import("./pages/Admin/PrintCenter"));
const OfflineOps = lazy(() => import("./pages/Admin/OfflineOps"));
const LaunchReadiness = lazy(() => import("./pages/Admin/LaunchReadiness"));
const SreIncidentOps = lazy(() => import("./pages/Admin/SreIncidentOps"));
const SupportTickets = lazy(() => import("./pages/Admin/SupportTickets"));
const PilotOnboardingOps = lazy(() => import("./pages/Admin/PilotOnboardingOps"));

/* =======================
   DASHBOARDS
======================= */
const DoctorDashboard = lazy(() => import("./pages/Doctor/Dashboard"));
const PatientDashboard = lazy(() => import("./pages/Patient/Dashboard"));
const NurseDashboard = lazy(() => import("./pages/Nurse/Dashboard"));
const LabTechDashboard = lazy(() => import("./pages/LabTech/Dashboard"));
const PharmacyDashboard = lazy(() => import("./pages/Pharmacy/Index"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdmin/Dashboard"));
const SuperAdminHospitals = lazy(() => import("./pages/SuperAdmin/Hospitals"));
const SuperAdminSystemSettings = lazy(() => import("./pages/SuperAdmin/SystemSettings"));
const SuperAdminPharmacies = lazy(() => import("./pages/SuperAdmin/Pharmacies"));
const HospitalAdminDashboard = lazy(() => import("./pages/HospitalAdmin/Dashboard"));
const HospitalAdminRegisterStaff = lazy(() => import("./pages/HospitalAdmin/RegisterStaff"));
const HospitalAdminApprovals = lazy(() => import("./pages/HospitalAdmin/Approvals"));
const HospitalAdminStaffManagement = lazy(() => import("./pages/HospitalAdmin/StaffManagement"));
const HospitalAdminCommerceConfig = lazy(() => import("./pages/HospitalAdmin/CommerceConfig"));
const HospitalAdminFinancials = lazy(() => import("./pages/HospitalAdmin/Financials"));
const HospitalAdminAppointments = lazy(() => import("./pages/HospitalAdmin/Appointments"));
const HospitalAdminConsultationMonitor = lazy(() => import("./pages/HospitalAdmin/ConsultationMonitor"));
const HospitalAdminEscalationQueue = lazy(() => import("./pages/HospitalAdmin/EscalationQueue"));
const HospitalAdminAppointmentAnalytics = lazy(() => import("./pages/HospitalAdmin/AppointmentAnalytics"));
const HospitalAdminRecruitmentAds = lazy(() => import("./pages/HospitalAdmin/RecruitmentAds"));
const HospitalCustomization = lazy(() => import("./pages/HospitalAdmin/Customization"));
const HospitalAdminMachineConnectivity = lazy(() => import("./pages/HospitalAdmin/MachineConnectivity"));
const HospitalAdminMachineAlerts = lazy(() => import("./pages/HospitalAdmin/MachineAlerts"));
const HospitalAdminPharmacyReferrals = lazy(() => import("./pages/HospitalAdmin/PharmacyReferrals"));
const HospitalAdminStaffTransfers = lazy(() => import("./pages/HospitalAdmin/StaffTransfers"));
const HospitalAdminTransferCommandCenter = lazy(() => import("./pages/HospitalAdmin/TransferCommandCenter"));
const ClaimsDashboard = lazy(() => import("./pages/HospitalAdmin/ClaimsDashboard"));
const SecurityOfficerDashboard = lazy(() => import("./pages/Security/OfficerDashboard"));
const SecurityAdminDashboard = lazy(() => import("./pages/Security/AdminDashboard"));
const StaffDashboard = lazy(() => import("./pages/Staff/Dashboard"));
const RadiologistDashboard = lazy(() => import("./pages/Radiologist/Dashboard"));
const TherapistDashboard = lazy(() => import("./pages/Therapist/Dashboard"));
const ReceptionistDashboard = lazy(() => import("./pages/Receptionist/Dashboard"));
const ReceptionistBookingDesk = lazy(() => import("./pages/Receptionist/BookingDesk"));
const SurgeonDashboard = lazy(() => import("./pages/Surgeon/Dashboard"));
const HRManagerDashboard = lazy(() => import("./pages/HRManager/Dashboard"));
const PayrollOfficerDashboard = lazy(() => import("./pages/PayrollOfficer/Dashboard"));
const DeveloperDashboard = lazy(() => import("./pages/Developer/Dashboard"));
const SystemAdminDashboard = lazy(() => import("./pages/SystemAdmin/Dashboard"));
const AbacPolicies = lazy(() => import("./pages/SystemAdmin/AbacPolicies"));
const MappingStudio = lazy(() => import("./pages/SystemAdmin/MappingStudio"));
const NlpAnalytics = lazy(() => import("./pages/SystemAdmin/NlpAnalytics"));
const RegulatoryReports = lazy(() => import("./pages/SystemAdmin/RegulatoryReports"));
const ComplianceCenter = lazy(() => import("./pages/SystemAdmin/ComplianceCenter"));
const ClinicalIntelligence = lazy(() => import("./pages/SystemAdmin/ClinicalIntelligence"));
const RevenueIntelligence = lazy(() => import("./pages/SystemAdmin/RevenueIntelligence"));
const SystemMigrations = lazy(() => import("./pages/SystemAdmin/Migrations"));
const ConnectorSdk = lazy(() => import("./pages/SystemAdmin/ConnectorSdk"));
const IntegrationHub = lazy(() => import("./pages/SystemAdmin/IntegrationHub"));
const IntegrationControlPlane = lazy(() => import("./pages/SystemAdmin/IntegrationControlPlane"));
const CountyCommandCenter = lazy(() => import("./pages/SystemAdmin/CountyCommandCenter"));
const PharmacyAccessAudit = lazy(() => import("./pages/SystemAdmin/PharmacyAccessAudit"));
const GovernmentHospitalRegistryPage = lazy(() => import("./pages/SystemAdmin/GovernmentHospitalRegistry"));
const PatientIdentityRegistryPage = lazy(() => import("./pages/SystemAdmin/PatientIdentityRegistry"));
const ClaimRules = lazy(() => import("./pages/SystemAdmin/ClaimRules"));
const HospitalVerificationReview = lazy(() => import("./pages/SystemAdmin/HospitalVerificationReview"));
const FraudGuard = lazy(() => import("./pages/SystemAdmin/FraudGuard"));
const GovernmentClaimsDashboard = lazy(() => import("./pages/SystemAdmin/GovernmentClaimsDashboard"));
const UnifiedAssistantDashboard = lazy(() => import("./pages/SystemAdmin/UnifiedAssistantDashboard"));
const CommunicationCenter = lazy(() => import("./pages/Communication/Center"));
const MyRequests = lazy(() => import("./pages/Workforce/MyRequests"));
const QueueReplay = lazy(() => import("./pages/Developer/QueueReplay"));
const WebhookRetry = lazy(() => import("./pages/Developer/WebhookRetry"));
const DecisionCockpit = lazy(() => import("./pages/Developer/DecisionCockpit"));
const ProvenanceVerify = lazy(() => import("./pages/Developer/ProvenanceVerify"));
const AIExtractionHistory = lazy(() => import("./pages/Developer/AIExtractionHistory"));
const CommunityHealthWorkerDashboard = lazy(() => import("./pages/CommunityHealthWorker/Dashboard"));
const TriageOpsDashboard = lazy(() => import("./pages/Operations/TriageOpsDashboard"));
const IcuOpsDashboard = lazy(() => import("./pages/Operations/IcuOpsDashboard"));
const TheatreOpsDashboard = lazy(() => import("./pages/Operations/TheatreOpsDashboard"));
const ImagingOpsDashboard = lazy(() => import("./pages/Operations/ImagingOpsDashboard"));
const EmergencyCommandDashboard = lazy(() => import("./pages/Operations/EmergencyCommandDashboard"));
const NeonatalIcuDashboard = lazy(() => import("./pages/Operations/NeonatalIcuDashboard"));
const DialysisOpsDashboard = lazy(() => import("./pages/Operations/DialysisOpsDashboard"));
const OncologyDaycareDashboard = lazy(() => import("./pages/Operations/OncologyDaycareDashboard"));

/* =======================
   ADMIN
======================= */
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const AuditLogs = lazy(() => import("./pages/Admin/AuditLogs"));
const AIAutofillAudit = lazy(() => import("./pages/Admin/AIAutofillAudit"));
const CreateAdmin = lazy(() => import("./pages/Admin/CreateAdmin"));
const SuperAssistants = lazy(() => import("./pages/Admin/SuperAssistants"));
const TrainingTracker = lazy(() => import("./pages/Admin/TrainingTracker"));
const TrainingPlaybook = lazy(() => import("./pages/Admin/TrainingPlaybook"));
const Beds = lazy(() => import("./pages/Admin/Beds"));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background:
          "radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 35%), linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%)",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          padding: "28px 24px",
          borderRadius: "24px",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(148,163,184,0.18)",
          boxShadow: "0 24px 60px rgba(15,23,42,0.12)",
          textAlign: "center",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 18px",
            borderRadius: "50%",
            border: "4px solid rgba(14,165,233,0.18)",
            borderTopColor: "#0ea5e9",
            animation: "afyalinkSpin 0.9s linear infinite",
          }}
        />
        <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "#0f172a" }}>Loading your workspace</h2>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
          We’re opening the next screen and only loading the code that page actually needs.
        </p>
      </div>
    </div>
  );
}

function RootEntry() {
  const { user, loading } = useAuth();
  if (loading) return <div />;
  return <Navigate to={user ? redirectByRole(user) : "/login"} replace />;
}

const SHARED_NOTIFICATION_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "RECEPTIONIST",
  "SURGEON",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "RADIOLOGIST",
  "THERAPIST",
  "PATIENT",
];

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div />;
  if (user) return <Navigate to={redirectByRole(user)} replace />;
  return children;
}

function PatientSelfServiceRoute({ children }) {
  return (
    <RequireRole roles={["PATIENT", "SUPER_ADMIN", "DEVELOPER"]}>
      <PatientLanguageProvider>{children}</PatientLanguageProvider>
    </RequireRole>
  );
}

/* =====================================================
   APP LAYOUT (PROTECTED)
===================================================== */
function AppLayout() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [securityNotice, setSecurityNotice] = useState(null);
  const getOfflineDeviceId = () => {
    const key = "afyalink_offline_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  };
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_reminders") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user) return;
    applyAccessibilityPrefs(loadAccessibilityPrefs(user));
  }, [user]);

  useEffect(() => {
    if (!user?.role) return;
    prefetchRoutesForRole(user.role);
  }, [user?.role]);

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
      case "HOSPITAL_ADMIN_ASSISTANT":
        return "/api/dashboard/hospital-admin";
      case "SECURITY_ADMIN":
        return "/api/dashboard/security-admin";
      case "SECURITY_OFFICER":
        return "/api/dashboard/security-officer";
      case "PATIENT":
        return "/api/dashboard/patient";
      case "COMMUNITY_HEALTH_WORKER":
        return "/api/dashboard/community-health-worker";
      case "SUPER_ADMIN":
        return "/api/dashboard/super-admin";
      case "RADIOLOGIST":
        return "/api/dashboard/radiologist";
      case "THERAPIST":
        return "/api/dashboard/therapist";
      case "RECEPTIONIST":
        return "/api/dashboard/receptionist";
      case "SURGEON":
        return "/api/dashboard/surgeon";
      default:
        return null;
    }
  };

  useEffect(() => {
    const postMetrics = async (snapshot) => {
      if (!user) return;
      try {
        await pushOfflineClientMetrics({
          deviceId: getOfflineDeviceId(),
          snapshot: {
            ...(snapshot || refreshOfflineMetricsSnapshot()),
            online: navigator.onLine,
          },
        });
      } catch {
        // swallow telemetry failures
      }
    };

    const stop = startOfflineAutoSync(async (item) => {
      await apiFetch(item.path, {
        method: item.method,
        body: item.body,
        _skipOfflineQueue: true,
      });
    }, {
      onMetrics: (snapshot) => postMetrics(snapshot),
    });
    const onMetricsUpdate = (ev) => postMetrics(ev?.detail || null);
    window.addEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
    const timer = setInterval(() => postMetrics(), 60000);
    return () => {
      stop?.();
      window.removeEventListener("afyalink:offline-metrics-updated", onMetricsUpdate);
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen, user]);

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
              action: () => navigate("/notifications"),
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
            ["RADIOLOGIST", "THERAPIST", "RECEPTIONIST", "SURGEON"].includes(role) &&
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
                    ? "/notifications"
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
            <button type="button" className="verify-banner" onClick={() => navigate("/step-up")}>
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
              type="button"
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
    </>
  );
}

/* =====================================================
   APP
===================================================== */
export default function App() {
  return (
    <SocketProvider>
      <AppErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        {/* ============ PUBLIC ROUTES ============ */}
        <Route path="/" element={<RootEntry />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <Register />
            </PublicOnly>
          }
        />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-success" element={<VerifySuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/careers"
          element={
            <PatientLanguageProvider>
              <CareersLanding />
            </PatientLanguageProvider>
          }
        />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
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
              <PatientSelfServiceRoute>
                <PatientDashboard />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/community-health-worker"
            element={
              <RequireRole roles={["COMMUNITY_HEALTH_WORKER", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HR_MANAGER"]}>
                <CommunityHealthWorkerDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <PatientSelfServiceRoute>
                <PatientAppointments />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/medical-records"
            element={
              <PatientSelfServiceRoute>
                <PatientMedicalRecords />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/family-records"
            element={
              <PatientSelfServiceRoute>
                <PatientFamilyRecords />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/family-timeline"
            element={
              <PatientSelfServiceRoute>
                <PatientFamilyTimeline />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/prescriptions"
            element={
              <PatientSelfServiceRoute>
                <PatientPrescriptions />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/lab-results"
            element={
              <PatientSelfServiceRoute>
                <PatientLabResults />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/billing"
            element={
              <PatientSelfServiceRoute>
                <PatientBilling />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/insurance"
            element={
              <PatientSelfServiceRoute>
                <PatientInsurance />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/transfers"
            element={
              <PatientSelfServiceRoute>
                <PatientTransfers />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/hospitals"
            element={
              <PatientSelfServiceRoute>
                <PatientHospitals />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/feedback"
            element={
              <PatientSelfServiceRoute>
                <PatientFeedback />
              </PatientSelfServiceRoute>
            }
          />
          <Route
            path="/patient/ads"
            element={
              <PatientSelfServiceRoute>
                <PatientAdsFeed />
              </PatientSelfServiceRoute>
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
          <Route
            path="/surgeon"
            element={
              <RequireRole roles={["SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <SurgeonDashboard />
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
          <Route
            path="/radiologist"
            element={
              <RequireRole roles={["RADIOLOGIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <RadiologistDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/therapist"
            element={
              <RequireRole roles={["THERAPIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <TherapistDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/receptionist"
            element={
              <RequireRole roles={["RECEPTIONIST", "SUPER_ADMIN", "DEVELOPER"]}>
                <ReceptionistDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/receptionist/booking-desk"
            element={
              <RequireRole roles={["RECEPTIONIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "DEVELOPER"]}>
                <ReceptionistBookingDesk />
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
              <RequireRole roles={["DEVELOPER", "SYSTEM_ADMIN", "SUPER_ADMIN"]}>
                <DeveloperDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/developer/queue-replay"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                <QueueReplay />
              </RequireRole>
            }
          />
          <Route
            path="/developer/webhook-retry"
            element={
              <RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}>
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
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <SuperAdminSystemSettings />
              </RequireRole>
            }
          />
          <Route
            path="/super-admin/pharmacies"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <SuperAdminPharmacies />
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
            path="/system-admin/compliance-center"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <ComplianceCenter />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/revenue-intelligence"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <RevenueIntelligence />
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
          <Route
            path="/system-admin/migrations"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}>
                <SystemMigrations />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/integration-hub"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <IntegrationHub />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/integration-control-plane"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <IntegrationControlPlane />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/county-command-center"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <CountyCommandCenter />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/connector-sdk"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}>
                <ConnectorSdk />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/pharmacy-access-audit"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <PharmacyAccessAudit />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/government-hospital-registry"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <GovernmentHospitalRegistryPage />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/patient-identity-registry"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientIdentityRegistryPage />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/claim-rules"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <ClaimRules />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/hospital-verification-review"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalVerificationReview />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/fraud-guard"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN"]}>
                <FraudGuard />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/government-claims"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}>
                <GovernmentClaimsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/system-admin/unified-assistant"
            element={
              <RequireRole roles={["SUPER_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <UnifiedAssistantDashboard />
              </RequireRole>
            }
          />

          {/* HOSPITAL ADMIN */}
          <Route
            path="/hospital-admin"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/register-staff"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <HospitalAdminRegisterStaff />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/approvals"
            element={
              <RequireRole
                roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}
              >
                <HospitalAdminApprovals />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/staff"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <HospitalAdminStaffManagement />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/staff-transfers"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <HospitalAdminStaffTransfers />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/transfer-command-center"
            element={
              <RequireRole roles={["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <HospitalAdminTransferCommandCenter />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/ward-board"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <Beds />
              </RequireRole>
            }
          />
          <Route
            path="/nurse/ward-board"
            element={
              <RequireRole roles={["NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <Beds />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/ward-board"
            element={
              <RequireRole roles={["DOCTOR", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}>
                <Beds />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/appointments"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminAppointments />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/claims"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"]}>
                <ClaimsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/revenue-intelligence"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <RevenueIntelligence />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/consultation-monitor"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminConsultationMonitor />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/escalations"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminEscalationQueue />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/escalations"
            element={
              <RequireRole roles={["DOCTOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminEscalationQueue viewer="doctor" />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/appointment-analytics"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminAppointmentAnalytics />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/commerce-config"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminCommerceConfig />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/financials"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminFinancials />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/recruitment-ads"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminRecruitmentAds />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/customization"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalCustomization />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/machine-connectivity"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminMachineConnectivity />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/machine-alerts"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminMachineAlerts />
              </RequireRole>
            }
          />
          <Route
            path="/hospital-admin/pharmacy-referrals"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR", "SURGEON", "NURSE", "RECEPTIONIST", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <HospitalAdminPharmacyReferrals />
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

          <Route
            path="/admin/print-center"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST"]}>
                <PrintCenter />
              </RequireRole>
            }
          />
          <Route
            path="/admin/offline-ops"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}>
                <OfflineOps />
              </RequireRole>
            }
          />

          {/* ADMIN TOOLS */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"]}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route
              path="ai-autofill-audit"
              element={
                <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}>
                  <AIAutofillAudit />
                </RequireRole>
              }
            />
            <Route path="beds" element={<Beds />} />
            <Route path="realtime" element={<RealTimeIntegrations />} />
            <Route path="crdt-patients" element={<CRDTPatientEditor />} />
            <Route path="access-control" element={<AccessControl />} />
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
                <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                  <CreateAdmin />
                </RequireRole>
              }
            />
            <Route
              path="super-assistants"
              element={
                <RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN"]}>
                  <SuperAssistants />
                </RequireRole>
              }
            />
            <Route
              path="training-tracker"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                    "HR_MANAGER",
                  ]}
                >
                  <TrainingTracker />
                </RequireRole>
              }
            />
            <Route
              path="training-playbook"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                    "HR_MANAGER",
                  ]}
                >
                  <TrainingPlaybook />
                </RequireRole>
              }
            />
            <Route
              path="launch-readiness"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                  ]}
                >
                  <LaunchReadiness />
                </RequireRole>
              }
            />
            <Route
              path="sre-incidents"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                    "SECURITY_ADMIN",
                  ]}
                >
                  <SreIncidentOps />
                </RequireRole>
              }
            />
            <Route
              path="support-tickets"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                    "HR_MANAGER",
                    "SECURITY_ADMIN",
                  ]}
                >
                  <SupportTickets />
                </RequireRole>
              }
            />
            <Route
              path="pilot-onboarding"
              element={
                <RequireRole
                  roles={[
                    "SUPER_ADMIN",
                    "SYSTEM_ADMIN",
                    "DEVELOPER",
                    "HOSPITAL_ADMIN",
                    "HR_MANAGER",
                  ]}
                >
                  <PilotOnboardingOps />
                </RequireRole>
              }
            />
          </Route>

          {/* SHARED PAGES */}
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/admin/notifications"
            element={
              <RequireRole roles={SHARED_NOTIFICATION_ROLES}>
                <NotificationsPage />
              </RequireRole>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireRole roles={SHARED_NOTIFICATION_ROLES}>
                <NotificationsPage />
              </RequireRole>
            }
          />
          <Route
            path="/communication"
            element={
              <RequireRole
                roles={[
                  "SUPER_ADMIN",
                  "SYSTEM_ADMIN",
                  "DEVELOPER",
                  "HOSPITAL_ADMIN",
                  "HOSPITAL_ADMIN_ASSISTANT",
                  "DOCTOR",
                  "NURSE",
                  "LAB_TECH",
                  "PHARMACIST",
                  "SECURITY_ADMIN",
                  "SECURITY_OFFICER",
                  "RECEPTIONIST",
                  "SURGEON",
                  "HR_MANAGER",
                  "PAYROLL_OFFICER",
                ]}
              >
                <CommunicationCenter />
              </RequireRole>
            }
          />
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
                  "HOSPITAL_ADMIN_ASSISTANT",
                  "HR_MANAGER",
                  "PAYROLL_OFFICER",
                  "DOCTOR",
                  "NURSE",
                  "LAB_TECH",
                  "PHARMACIST",
                  "SURGEON",
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
            path="/ops/triage"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <TriageOpsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/icu"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <IcuOpsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/theatre"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <TheatreOpsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/imaging"
            element={
              <RequireRole roles={["RADIOLOGIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <ImagingOpsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/emergency-command"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "SECURITY_ADMIN", "SECURITY_OFFICER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <EmergencyCommandDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/neonatal-icu"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <NeonatalIcuDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/dialysis"
            element={
              <RequireRole roles={["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <DialysisOpsDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/ops/oncology-daycare"
            element={
              <RequireRole roles={["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}>
                <OncologyDaycareDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/appointments"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorAppointments />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/transfers"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorTransfers />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/schedule"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <MySchedule />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <MyPatients />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/opd"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <OPDWorkspace />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/ward"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <InpatientWard />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/surgery"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <SurgeryProcedures />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/lab-results"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <LabResults />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/prescriptions"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <Prescriptions />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/medical-records"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <MedicalRecords />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/referrals"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <Referrals />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/performance"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorPerformance />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/cme"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <CMECertifications />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/leave"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorLeaveRequests />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/reports-notes"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
                <DoctorReportsNotes />
              </RequireRole>
            }
          />
          <Route
            path="/doctor/settings"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}>
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
        </Suspense>
        <FloatingAI />
      </AppErrorBoundary>
    </SocketProvider>
  );
}
