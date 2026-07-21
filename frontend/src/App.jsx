import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./utils/auth";
import SocketProvider from "./utils/socket";
import { redirectByRole } from "./utils/redirectByRole";
import { PatientLanguageProvider } from "./utils/patientLanguage.jsx";

import { NavigationProvider, CommandPalette } from "./components/Navigation";
import FloatingAI from "./components/FloatingAI";
import RequireRole from "./components/RequireRole";
import AutoRedirect from "./components/AutoRedirect";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { RouteGuard } from "./components/RouteGuard";
import AppShellSkeleton from "./components/AppShellSkeleton";
import AuthGateFallback from "./components/AuthGateFallback";
import GlobalProgressBar from "./components/GlobalProgressBar";
import RouteProgressEvents from "./components/RouteProgressEvents";
import ActionSuccessGuide from "./components/ActionSuccessGuide";
import UXAuditMode from "./components/UXAuditMode";

import AppShell from "./app/shell/AppShell";
import MainLayout from "./layouts/MainLayout";
import { LEGACY_ROUTE_MAP } from "./app/routing/legacyRouteMap";
import { createRuntimeRouteElements } from "./app/runtime/appRouteComposer";
import { isPatientExperienceMode } from "./pages/Patient/appointmentFeatureFlags";

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
const TransactionsDashboard = lazy(() => import("./pages/Admin/TransactionsDashboard"));
const HospitalKPIDashboard = lazy(() => import("./pages/Admin/HospitalKPIDashboard"));
const LabEncounterQueue = lazy(() => import("./pages/Lab/Index"));

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
const ClinicalOrderCopilot = lazy(() => import("./pages/Innovation/ClinicalOrderCopilot"));
const DigitalHospitalTwin = lazy(() => import("./pages/Innovation/DigitalHospitalTwin"));
const InteropMarketplace = lazy(() => import("./pages/Innovation/InteropMarketplace"));
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
const DriverHome = lazy(() => import("./pages/Operations/DriverHome"));
const MortuaryHome = lazy(() => import("./pages/Operations/MortuaryHome"));

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

/* =======================
   APP RESET WRAPPERS
======================= */
const CareHome = lazy(() => import("./app/features/care/CareHome"));
const OperationsHome = lazy(() => import("./app/features/operations/OperationsHome"));
const PlatformHome = lazy(() => import("./app/features/platform/PlatformHome"));
const GovernanceHome = lazy(() => import("./app/features/governance/GovernanceHome"));
const PeopleHome = lazy(() => import("./app/features/people/PeopleHome"));
const PortalHome = lazy(() => import("./app/features/portal/PortalHome"));
const InnovationHome = lazy(() => import("./app/features/innovation/InnovationHome"));

const CarePatients = lazy(() => import("./app/features/care/CarePatients"));
const CareEscalations = lazy(() => import("./app/features/care/CareEscalations"));
const SchedulingAppointments = lazy(() => import("./app/features/operations/SchedulingAppointments"));
const LeaveRequests = lazy(() => import("./app/features/people/LeaveRequests"));
const Performance = lazy(() => import("./app/features/people/Performance"));
const HospitalRegistry = lazy(() => import("./app/features/governance/HospitalRegistry"));

function RouteLoadingFallback() {
  return (
    <AppShellSkeleton
      title="Loading workspace"
      detail="Preparing the latest layout, data, and actions for this screen."
      status="Loading"
    />
  );
}

function RootEntry() {
  const { user, loading } = useAuth();
  if (loading && !user) {
    return <AuthGateFallback title="Loading workspace" detail="Preparing your workspace and routing the right page." />;
  }
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
  if (user) return <Navigate to={redirectByRole(user)} replace />;
  if (loading) return children;
  return children;
}

function LegacyRedirect({ to }) {
  const location = useLocation();
  let target = String(to || "/");
  const search = String(location.search || "");
  const hash = String(location.hash || "");

  if (search) {
    if (target.includes("?")) target = `${target}&${search.replace(/^[?]/, "")}`;
    else target = `${target}${search}`;
  }
  if (hash) target = `${target}${hash}`;

  return <Navigate to={target} replace />;
}

const FLOATING_AI_HIDDEN_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/verify-success",
  "/forgot-password",
  "/reset-password",
  "/careers",
  "/terms",
  "/privacy",
  "/2fa",
  "/step-up",
  "/unauthorized",
  "/403",
];

function FloatingAIGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || !user) return null;
  if (FLOATING_AI_HIDDEN_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) {
    return null;
  }

  return <FloatingAI />;
}

function ProtectedWorkspaceShell() {
  return (
    <RouteGuard
      fallback={<Navigate to="/unauthorized" replace />}
      loading={<RouteLoadingFallback />}
    >
      <AppShell />
    </RouteGuard>
  );
}

/* =====================================================
   APP
===================================================== */
export default function App() {
  const runtimeRouteElements = createRuntimeRouteElements();

  return (
    <SocketProvider>
      <NavigationProvider>
        <AppErrorBoundary>
          <CommandPalette />
          <GlobalProgressBar />
          <RouteProgressEvents />
          <ActionSuccessGuide />
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
                <ProtectedWorkspaceShell />
              </AutoRedirect>
            </RequireRole>
          }
        >
          {/* ============ CANONICAL /app ROUTES ============ */}
          <Route path="/app" element={<RootEntry />} />

          {/* Workspaces: Home */}
          <Route
            path="/app/care/home/index"
            element={
              <RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "RADIOLOGIST", "THERAPIST", "SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN"]}>
                <CareHome />
              </RequireRole>
            }
          />
          <Route
            path="/app/operations/home/index"
            element={
              <RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "RECEPTIONIST", "COMMUNITY_HEALTH_WORKER", "LAB_TECH", "PHARMACIST", "SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN"]}>
                <OperationsHome />
              </RequireRole>
            }
          />
          <Route
            path="/app/people/home/index"
            element={
              <RequireRole roles={["HR_MANAGER", "PAYROLL_OFFICER", "SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"]}>
                <PeopleHome />
              </RequireRole>
            }
          />
          <Route
            path="/app/revenue/home/index"
            element={<Navigate to="/app/revenue/payments/index" replace />}
          />
          <Route
            path="/app/platform/home/index"
            element={
              <RequireRole roles={["SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN", "SUPER_ASSISTANT", "SECURITY_ADMIN", "SECURITY_OFFICER"]}>
                <PlatformHome />
              </RequireRole>
            }
          />
          <Route
            path="/app/governance/home/index"
            element={
              <RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}>
                <GovernanceHome />
              </RequireRole>
            }
          />
          <Route path="/app/governance/claims/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><GovernmentClaimsDashboard /></RequireRole>} />
          <Route path="/app/governance/registry/hospitals" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><GovernmentHospitalRegistryPage /></RequireRole>} />
          <Route path="/app/governance/registry/patient-identity" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><PatientIdentityRegistryPage /></RequireRole>} />
          <Route path="/app/governance/verification/hospitals" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><HospitalVerificationReview /></RequireRole>} />
          <Route path="/app/governance/fraud/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><FraudGuard /></RequireRole>} />
          <Route path="/app/governance/reports/regulatory" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><RegulatoryReports /></RequireRole>} />
          <Route path="/app/governance/command/county" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_AUDITOR", "GOVERNMENT_INSPECTOR", "GOVERNMENT_ANALYST"]}><CountyCommandCenter /></RequireRole>} />
          <Route
            path="/app/innovation/home/index"
            element={
              <RequireRole roles={["SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "SURGEON"]}>
                <InnovationHome />
              </RequireRole>
            }
          />

          {/* Care */}
          <Route path="/app/care/patients/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "SUPER_ADMIN", "DEVELOPER"]}><CarePatients /></RequireRole>} />
          <Route path="/app/care/encounters/opd" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><OPDWorkspace /></RequireRole>} />
          <Route path="/app/care/encounters/inpatient" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><InpatientWard /></RequireRole>} />
          <Route path="/app/care/encounters/surgery" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><SurgeryProcedures /></RequireRole>} />
          <Route path="/app/care/diagnostics/lab-results" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "SUPER_ADMIN", "DEVELOPER"]}><LabResults /></RequireRole>} />
          <Route path="/app/care/medications/prescriptions" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><Prescriptions /></RequireRole>} />
          <Route path="/app/care/records/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><MedicalRecords /></RequireRole>} />
          <Route path="/app/care/referrals/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><Referrals /></RequireRole>} />
          <Route path="/app/care/transfers/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><DoctorTransfers /></RequireRole>} />
          <Route path="/app/care/escalations/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SYSTEM_ADMIN"]}><CareEscalations /></RequireRole>} />
          <Route path="/app/care/vitals/entry" element={<RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}><NurseVitalsEntry /></RequireRole>} />
          <Route path="/app/care/medication/administration" element={<RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}><NurseMedicationAdministration /></RequireRole>} />
          <Route path="/app/care/notes/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><DoctorReportsNotes /></RequireRole>} />
          <Route path="/app/care/intelligence/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "DOCTOR", "NURSE"]}><ClinicalIntelligence /></RequireRole>} />

          {/* Operations */}
          <Route path="/app/operations/driver/home" element={<RequireRole roles={["DRIVER", "AMBULANCE_DRIVER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><DriverHome /></RequireRole>} />
          <Route path="/app/operations/mortuary/home" element={<RequireRole roles={["MORTUARY_STAFF", "MORTUARY_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><MortuaryHome /></RequireRole>} />
          <Route path="/app/operations/bed-board/index" element={<RequireRole roles={["NURSE", "DOCTOR", "SURGEON", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><Beds /></RequireRole>} />
          <Route path="/app/operations/triage/index" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><TriageOpsDashboard /></RequireRole>} />
          <Route path="/app/operations/emergency/command" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "SECURITY_ADMIN", "SECURITY_OFFICER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><EmergencyCommandDashboard /></RequireRole>} />
          <Route path="/app/operations/units/icu" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><IcuOpsDashboard /></RequireRole>} />
          <Route path="/app/operations/units/theatre" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><TheatreOpsDashboard /></RequireRole>} />
          <Route path="/app/operations/units/imaging" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "RADIOLOGIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><ImagingOpsDashboard /></RequireRole>} />
          <Route path="/app/operations/units/neonatal-icu" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><NeonatalIcuDashboard /></RequireRole>} />
          <Route path="/app/operations/units/dialysis" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><DialysisOpsDashboard /></RequireRole>} />
          <Route path="/app/operations/units/oncology-daycare" element={<RequireRole roles={["DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><OncologyDaycareDashboard /></RequireRole>} />
          <Route path="/app/operations/consultations/monitor" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminConsultationMonitor /></RequireRole>} />
          <Route path="/app/operations/transfers/command" element={<RequireRole roles={["DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><HospitalAdminTransferCommandCenter /></RequireRole>} />
          <Route path="/app/operations/scheduling/appointments" element={<RequireRole roles={["DOCTOR", "SURGEON", "RECEPTIONIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><SchedulingAppointments /></RequireRole>} />
          <Route path="/app/operations/scheduling/analytics" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminAppointmentAnalytics /></RequireRole>} />
          <Route path="/app/operations/scheduling/my-schedule" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><MySchedule /></RequireRole>} />
          <Route path="/app/operations/front-desk/booking-desk" element={<RequireRole roles={["RECEPTIONIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "DEVELOPER"]}><ReceptionistBookingDesk /></RequireRole>} />
          <Route path="/app/operations/escalations/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminEscalationQueue /></RequireRole>} />
          <Route path="/app/operations/devices/connectivity" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminMachineConnectivity /></RequireRole>} />
          <Route path="/app/operations/devices/alerts" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminMachineAlerts /></RequireRole>} />
          <Route path="/app/operations/pharmacy/referrals" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR", "SURGEON", "NURSE", "RECEPTIONIST", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminPharmacyReferrals /></RequireRole>} />
          <Route path="/app/operations/inventory/index" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "PHARMACIST", "LAB_TECH", "DOCTOR"]}><Inventory /></RequireRole>} />
          <Route path="/app/operations/incidents/index" element={<RequireRole roles={["NURSE", "SECURITY_ADMIN", "SECURITY_OFFICER", "SUPER_ADMIN", "DEVELOPER"]}><NurseIncidentReports /></RequireRole>} />

          {/* Lab (ops) */}
          <Route path="/app/operations/lab/test-queue" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabTestQueue /></RequireRole>} />
          <Route path="/app/operations/lab/encounter-queue" element={<RequireRole roles={["LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><LabEncounterQueue /></RequireRole>} />
          <Route path="/app/operations/lab/equipment" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabEquipmentLogs /></RequireRole>} />
          <Route path="/app/operations/lab/samples" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabSampleTracking /></RequireRole>} />
          <Route path="/app/operations/lab/qc" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabQualityControl /></RequireRole>} />
          <Route path="/app/operations/lab/safety" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabSafetyChecklist /></RequireRole>} />
          <Route path="/app/operations/lab/archive" element={<RequireRole roles={["LAB_TECH", "SUPER_ADMIN", "DEVELOPER"]}><LabReportsArchive /></RequireRole>} />

          {/* Pharmacy (ops) */}
          <Route path="/app/operations/pharmacy/prescription-queue" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyQueue /></RequireRole>} />
          <Route path="/app/operations/pharmacy/inventory" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyInventory /></RequireRole>} />
          <Route path="/app/operations/pharmacy/controlled" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyControlled /></RequireRole>} />
          <Route path="/app/operations/pharmacy/expiry" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyExpiry /></RequireRole>} />
          <Route path="/app/operations/pharmacy/suppliers" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacySuppliers /></RequireRole>} />
          <Route path="/app/operations/pharmacy/reports" element={<RequireRole roles={["PHARMACIST", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyReports /></RequireRole>} />

          {/* People */}
          <Route path="/app/people/requests/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST", "SURGEON", "RADIOLOGIST", "THERAPIST", "RECEPTIONIST", "SECURITY_ADMIN", "SECURITY_OFFICER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><MyRequests /></RequireRole>} />
          <Route path="/app/people/requests/leave" element={<RequireRole roles={["DOCTOR", "NURSE", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><LeaveRequests /></RequireRole>} />
          <Route path="/app/people/schedule/shift" element={<RequireRole roles={["NURSE", "SUPER_ADMIN", "DEVELOPER"]}><NurseMyShift /></RequireRole>} />
          <Route path="/app/people/performance/index" element={<RequireRole roles={["DOCTOR", "NURSE", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><Performance /></RequireRole>} />
          <Route path="/app/people/training/tracker" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"]}><TrainingTracker /></RequireRole>} />
          <Route path="/app/people/training/playbook" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"]}><TrainingPlaybook /></RequireRole>} />
          <Route path="/app/people/training/cme" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><CMECertifications /></RequireRole>} />
          <Route path="/app/people/staff/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><HospitalAdminStaffManagement /></RequireRole>} />
          <Route path="/app/people/staff/register" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><HospitalAdminRegisterStaff /></RequireRole>} />
          <Route path="/app/people/staff/transfers" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><HospitalAdminStaffTransfers /></RequireRole>} />
          <Route path="/app/people/approvals/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><HospitalAdminApprovals /></RequireRole>} />
          <Route path="/app/people/recruitment/ads" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminRecruitmentAds /></RequireRole>} />

          {/* Revenue */}
          <Route path="/app/revenue/payments/index" element={<RequireRole roles={["PAYROLL_OFFICER", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "PATIENT"]}><PaymentsPageFull /></RequireRole>} />
          <Route path="/app/revenue/payments/settings" element={<RequireRole roles={["SUPER_ADMIN"]}><PaymentSettings /></RequireRole>} />
          <Route path="/app/revenue/transactions/index" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "PAYROLL_OFFICER", "DEVELOPER"]}><TransactionsDashboard /></RequireRole>} />
          <Route path="/app/revenue/claims/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"]}><ClaimsDashboard /></RequireRole>} />
          <Route path="/app/revenue/claims/rules" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><ClaimRules /></RequireRole>} />
          <Route path="/app/revenue/intelligence/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"]}><RevenueIntelligence /></RequireRole>} />
          <Route path="/app/revenue/commerce/config" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminCommerceConfig /></RequireRole>} />
          <Route path="/app/revenue/financials/index" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalAdminFinancials /></RequireRole>} />

          {/* Platform */}
          <Route path="/app/platform/settings/system" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><SuperAdminSystemSettings /></RequireRole>} />
          <Route path="/app/platform/compliance/center" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><ComplianceCenter /></RequireRole>} />
          <Route path="/app/platform/facility/customization" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><HospitalCustomization /></RequireRole>} />
          <Route path="/app/platform/account/profile" element={<Profile />} />
          <Route path="/app/platform/account/clinician-settings" element={<RequireRole roles={["DOCTOR", "SURGEON", "SUPER_ADMIN", "DEVELOPER"]}><DoctorSettings /></RequireRole>} />
          <Route path="/app/platform/inbox/notifications" element={<RequireRole roles={SHARED_NOTIFICATION_ROLES}><NotificationsPage /></RequireRole>} />
          <Route path="/app/platform/inbox/communication" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST", "SECURITY_ADMIN", "SECURITY_OFFICER", "RECEPTIONIST", "SURGEON", "HR_MANAGER", "PAYROLL_OFFICER"]}><CommunicationCenter /></RequireRole>} />
          <Route path="/app/platform/analytics/index" element={<Analytics />} />
          <Route path="/app/platform/analytics/hospital-kpis" element={<RequireRole roles={["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"]}><HospitalKPIDashboard /></RequireRole>} />
          <Route path="/app/platform/reports/index" element={<Reports />} />
          <Route path="/app/platform/offline/ops" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><OfflineOps /></RequireRole>} />
          <Route path="/app/platform/print/center" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST"]}><PrintCenter /></RequireRole>} />
          <Route path="/app/platform/audit/logs" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><AuditLogs /></RequireRole>} />
          <Route path="/app/platform/audit/pharmacy-access" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><PharmacyAccessAudit /></RequireRole>} />
          <Route path="/app/platform/security/admin/home" element={<RequireRole roles={["SECURITY_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><SecurityAdminDashboard /></RequireRole>} />
          <Route path="/app/platform/security/officer/home" element={<RequireRole roles={["SECURITY_OFFICER", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]}><SecurityOfficerDashboard /></RequireRole>} />
          <Route path="/app/platform/security/access-control" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><AccessControl /></RequireRole>} />
          <Route path="/app/platform/security/admin-creation" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "GOVERNMENT_ADMIN"]}><CreateAdmin /></RequireRole>} />
          <Route path="/app/platform/security/abac" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><AbacPolicies /></RequireRole>} />
          <Route path="/app/platform/admin/home" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"]}><AdminDashboard /></RequireRole>} />
          <Route path="/app/platform/ai/unified-assistant" element={<RequireRole roles={["SUPER_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><UnifiedAssistantDashboard /></RequireRole>} />
          <Route path="/app/platform/ai/super-assistants" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN"]}><SuperAssistants /></RequireRole>} />
          <Route path="/app/platform/ai/autofill-audit" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><AIAutofillAudit /></RequireRole>} />
          <Route path="/app/platform/ai/extraction-history" element={<RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}><AIExtractionHistory /></RequireRole>} />
          <Route path="/app/platform/ai/nlp-analytics" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"]}><NlpAnalytics /></RequireRole>} />
          <Route path="/app/platform/integrations/hub" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><IntegrationHub /></RequireRole>} />
          <Route path="/app/platform/integrations/control-plane" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><IntegrationControlPlane /></RequireRole>} />
          <Route path="/app/platform/integrations/mapping-studio" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]}><MappingStudio /></RequireRole>} />
          <Route path="/app/platform/integrations/realtime" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><RealTimeIntegrations /></RequireRole>} />
          <Route path="/app/platform/integrations/webhook-retry" element={<RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}><WebhookRetry /></RequireRole>} />
          <Route path="/app/platform/integrations/connector-sdk" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><ConnectorSdk /></RequireRole>} />
          <Route path="/app/platform/queues/replay" element={<RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}><QueueReplay /></RequireRole>} />
          <Route path="/app/platform/dev/home" element={<RequireRole roles={["DEVELOPER", "SYSTEM_ADMIN", "SUPER_ADMIN"]}><DeveloperDashboard /></RequireRole>} />
          <Route path="/app/platform/migrations/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><SystemMigrations /></RequireRole>} />
          <Route path="/app/platform/rollout/launch-readiness" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><LaunchReadiness /></RequireRole>} />
          <Route path="/app/platform/rollout/pilot-onboarding" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"]}><PilotOnboardingOps /></RequireRole>} />
          <Route path="/app/platform/sre/incidents" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN"]}><SreIncidentOps /></RequireRole>} />
          <Route path="/app/platform/support/tickets" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "SECURITY_ADMIN"]}><SupportTickets /></RequireRole>} />
          <Route path="/app/platform/trust/decision-cockpit" element={<RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}><DecisionCockpit /></RequireRole>} />
          <Route path="/app/platform/trust/provenance" element={<RequireRole roles={["DEVELOPER", "SUPER_ADMIN", "SYSTEM_ADMIN"]}><ProvenanceVerify /></RequireRole>} />
          <Route path="/app/platform/data/crdt/patients" element={<RequireRole roles={["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><CRDTPatientEditor /></RequireRole>} />

          {/* Innovation */}
          <Route path="/app/innovation/ai/medical" element={<MedicalAssistant />} />
          <Route path="/app/innovation/ai/triage" element={<Triage />} />
          <Route path="/app/innovation/ai/voice" element={<VoiceDictation />} />
          <Route path="/app/innovation/ai/chatbot" element={<Chatbot />} />
          <Route path="/app/innovation/ai/extract" element={<NeuroEdgeExtract />} />
          <Route path="/app/innovation/copilot/clinical-order" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR", "SURGEON"]}><ClinicalOrderCopilot /></RequireRole>} />
          <Route path="/app/innovation/digital-twin/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><DigitalHospitalTwin /></RequireRole>} />
          <Route path="/app/innovation/interop-marketplace/index" element={<RequireRole roles={["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"]}><InteropMarketplace /></RequireRole>} />

          {/* Patient Portal workspace (mobile-first surface) */}
          <Route path="/app/portal/home/index" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PortalHome /></PatientLanguageProvider></RequireRole>} />
          <Route
            path="/app/portal/appointments/index"
            element={
              <RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER", "DOCTOR", "SURGEON", "NURSE", "RADIOLOGIST", "THERAPIST", "LAB_TECH", "PHARMACIST", "RECEPTIONIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER", "PAYROLL_OFFICER", "SECURITY_ADMIN", "SECURITY_OFFICER", "SYSTEM_ADMIN"]}>
                <PatientLanguageProvider>
                  <PatientAppointments />
                </PatientLanguageProvider>
              </RequireRole>
            }
          />
          <Route path="/app/portal/records/index" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientMedicalRecords /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/family/records" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientFamilyRecords /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/family/timeline" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientFamilyTimeline /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/medications/prescriptions" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientPrescriptions /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/diagnostics/lab-results" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientLabResults /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/billing/index" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientBilling /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/insurance/index" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientInsurance /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/transfers/index" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientTransfers /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/discovery/hospitals" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientHospitals /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/support/feedback" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientFeedback /></PatientLanguageProvider></RequireRole>} />
          <Route path="/app/portal/discovery/ads" element={<RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}><PatientLanguageProvider><PatientAdsFeed /></PatientLanguageProvider></RequireRole>} />
          <Route
            path="/app/portal"
            element={
              <RequireRole roles={["PATIENT", "GUEST", "SUPER_ADMIN", "DEVELOPER"]}>
                <PatientLanguageProvider>
                  <Outlet />
                </PatientLanguageProvider>
              </RequireRole>
            }
          >
            <Route path="home/index" element={<PortalHome />} />
            <Route path="appointments/index" element={<PatientAppointments />} />
            <Route path="records/index" element={<PatientMedicalRecords />} />
            <Route path="family/records" element={<PatientFamilyRecords />} />
            <Route path="family/timeline" element={<PatientFamilyTimeline />} />
            <Route path="medications/prescriptions" element={<PatientPrescriptions />} />
            <Route path="diagnostics/lab-results" element={<PatientLabResults />} />
            <Route path="billing/index" element={<PatientBilling />} />
            <Route path="insurance/index" element={<PatientInsurance />} />
            <Route path="transfers/index" element={<PatientTransfers />} />
            <Route path="discovery/hospitals" element={<PatientHospitals />} />
            <Route path="support/feedback" element={<PatientFeedback />} />
            <Route path="discovery/ads" element={<PatientAdsFeed />} />
          </Route>

          {/* Legacy URL redirects (old → new). */}
          {runtimeRouteElements}

          {Object.entries(LEGACY_ROUTE_MAP).map(([from, to]) => (
            <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
          ))}
        </Route>

              {/* ============ 404 ============ */}
              <Route path="*" element={<div>404 — Page not found</div>} />
            </Routes>
          </Suspense>
          <FloatingAIGate />
          <UXAuditMode />
        </AppErrorBoundary>
      </NavigationProvider>
    </SocketProvider>
  );
}
