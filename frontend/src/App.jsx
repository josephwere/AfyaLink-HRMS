import "./theme-d.css";
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./utils/auth";
import SocketProvider from "./utils/socket";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Notifications from "./components/Notifications";
import AIChatWS from "./components/AIChatWS";

/* =======================
   PUBLIC / AUTH
======================= */
import GuestDashboard from "./pages/GuestDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Unauthorized from "./pages/Unauthorized";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TwoFactor from "./pages/TwoFactor";

/* =======================
   DASHBOARDS
======================= */
import SuperAdminDashboard from "./pages/SuperAdmin/Dashboard";
import HospitalAdminDashboard from "./pages/HospitalAdmin/Dashboard";
import DoctorDashboard from "./pages/Doctor/Dashboard";
import PatientDashboard from "./pages/Patient/Dashboard";

/* =======================
   SUPER ADMIN
======================= */
import RBAC from "./pages/SuperAdmin/RBAC";
import ML from "./pages/SuperAdmin/ML";

/* =======================
   AI
======================= */
import MedicalAssistant from "./pages/AI/MedicalAssistant";
import Chatbot from "./pages/AI/Chatbot";
import Triage from "./pages/AI/Triage";
import VoiceDictation from "./pages/AI/VoiceDictation";

/* =======================
   HOSPITAL ADMIN
======================= */
import Patients from "./pages/HospitalAdmin/Patients";
import Financials from "./pages/HospitalAdmin/Financials";
import Branches from "./pages/HospitalAdmin/Branches";
import Pharmacy from "./pages/HospitalAdmin/Pharmacy";
import Inventory from "./pages/HospitalAdmin/Inventory";

/* =======================
   DOCTOR / LAB
======================= */
import Appointments from "./pages/Doctor/Appointments";
import LabTests from "./pages/LabTech/LabTests";
import Lab from "./pages/LabTech/Lab";

/* =======================
   PAYMENTS
======================= */
import PaymentsPage from "./pages/Payments/PaymentsPage";
import PaymentsPageFull from "./pages/Payments/PaymentsFull";

/* =======================
   ADMIN (ENTERPRISE)
======================= */
import AdminDashboard from "./pages/Admin/Dashboard";
import Analytics from "./pages/Admin/Analytics";
import Reports from "./pages/Admin/Reports";
import NotificationsPage from "./pages/Admin/NotificationsPage";
import CRDTPatientEditor from "./pages/Admin/CRDTPatientEditor";
import RealTimeIntegrations from "./pages/Admin/RealTimeIntegrations";
import AuditLogs from "./pages/Admin/AuditLogs";

/* =====================================================
   🔐 PROTECTED ROUTE (ROLE + 2FA ENFORCED)
===================================================== */
function Protected({ roles }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "guest") {
    return <Navigate to="/guest" replace />;
  }

  if (user.twoFactorRequired === true) {
    return <Navigate to="/2fa" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

/* =====================================================
   APP LAYOUT
===================================================== */
function AppLayout() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <div className="app-grid">
        {user && <Sidebar />}
        <main className="main">
          {user && <Notifications />}
          <Outlet />
        </main>
      </div>
    </>
  );
}

/* =====================================================
   APP ROUTER (FINAL)
===================================================== */
export default function App() {
  return (
    <SocketProvider>
      <Routes>

        {/* -------- PUBLIC -------- */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/2fa" element={<TwoFactor />} />

        {/* -------- GUEST -------- */}
        <Route path="/guest" element={<GuestDashboard />} />

        {/* -------- AUTHENTICATED -------- */}
        <Route element={<Protected />}>
          <Route element={<AppLayout />}>

            <Route index element={<div>Welcome to AfyaLink HRMS 🚀</div>} />

            {/* Super Admin */}
            <Route path="superadmin" element={<SuperAdminDashboard />} />
            <Route path="superadmin/rbac" element={<RBAC />} />
            <Route path="superadmin/ml" element={<ML />} />

            {/* Hospital Admin */}
            <Route path="hospitaladmin" element={<HospitalAdminDashboard />} />
            <Route path="hospitaladmin/patients" element={<Patients />} />
            <Route path="hospitaladmin/financials" element={<Financials />} />
            <Route path="hospitaladmin/branches" element={<Branches />} />

            {/* Doctor */}
            <Route path="doctor" element={<DoctorDashboard />} />
            <Route path="doctor/appointments" element={<Appointments />} />

            {/* Lab */}
            <Route path="labtech/labs" element={<LabTests />} />
            <Route path="lab" element={<Lab />} />

            {/* Patient */}
            <Route path="patient" element={<PatientDashboard />} />

            {/* AI */}
            <Route path="ai/medical" element={<MedicalAssistant />} />
            <Route path="ai/chatbot" element={<Chatbot />} />
            <Route path="ai/triage" element={<Triage />} />
            <Route path="ai/voice" element={<VoiceDictation />} />
            <Route path="ai/ws" element={<AIChatWS />} />

            {/* Admin Core */}
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/realtime" element={<RealTimeIntegrations />} />
            <Route path="admin/crdt-patients" element={<CRDTPatientEditor />} />
            <Route path="admin/notifications" element={<NotificationsPage />} />

            {/* 🔐 AUDIT LOGS (ADMIN + SUPER ADMIN ONLY) */}
            <Route
              element={
                <Protected roles={["SUPER_ADMIN", "HOSPITAL_ADMIN"]} />
              }
            >
              <Route path="admin/audit" element={<AuditLogs />} />
            </Route>

            {/* Analytics & Reports */}
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />

            {/* Pharmacy & Inventory */}
            <Route path="pharmacy" element={<Pharmacy />} />
            <Route path="inventory" element={<Inventory />} />

            {/* Payments */}
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payments/full" element={<PaymentsPageFull />} />

            {/* 404 */}
            <Route path="*" element={<div>404 — Page not found</div>} />

          </Route>
        </Route>
      </Routes>
    </SocketProvider>
  );
}
