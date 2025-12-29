import "./theme-d.css";
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "./utils/auth";
import { apiFetch } from "./utils/apiFetch";
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
   ADMIN
======================= */
import AdminDashboard from "./pages/Admin/Dashboard";
import Analytics from "./pages/Admin/Analytics";
import Reports from "./pages/Admin/Reports";
import NotificationsPage from "./pages/Admin/NotificationsPage";
import CRDTPatientEditor from "./pages/Admin/CRDTPatientEditor";
import RealTimeIntegrations from "./pages/Admin/RealTimeIntegrations";
import AuditLogs from "./pages/Admin/AuditLogs";

import VerifySuccess from "./pages/VerifySuccess";

/* =====================================================
   ⚠️ VERIFICATION BANNER (FULL FEATURED)
===================================================== */
function VerificationBanner({ user }) {
  const { logout, setUser } = useAuth();
  const navigate = useNavigate();

  const [timeLeft, setTimeLeft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.verificationDeadline) return;

    const update = () => {
      const ms = new Date(user.verificationDeadline) - new Date();

      if (ms <= 0) {
        logout();
        return;
      }

      const mins = Math.floor(ms / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);

      if (days > 0) setTimeLeft(`${days} day(s) remaining`);
      else if (hrs > 0) setTimeLeft(`${hrs} hour(s) remaining`);
      else setTimeLeft(`${mins} minute(s) remaining`);
    };

    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [user, logout]);

  if (!user || user.emailVerified) return null;

  const resend = async () => {
    try {
      setSending(true);
      await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });
      alert("Verification email sent 📩");
    } catch {
      alert("Failed to resend email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff3cd",
        border: "1px solid #ffecb5",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <strong>⚠️ Kindly verify your account</strong>

      <div style={{ marginTop: 6, fontSize: 14 }}>
        Your profile will be deleted if not verified.
      </div>

      <div style={{ marginTop: 4, fontWeight: 600 }}>
        ⏱ {timeLeft}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <button
          className="primary"
          onClick={() => navigate("/verify-email")}
        >
          Verify now
        </button>

        <button
          className="secondary"
          disabled={sending}
          onClick={resend}
        >
          {sending ? "Sending…" : "Resend email"}
        </button>
      </div>
    </div>
  );
}

/* =====================================================
   🔐 PROTECTED
===================================================== */
function Protected({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.twoFactorRequired) return <Navigate to="/2fa" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

/* =====================================================
   LAYOUT
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
          {user && <VerificationBanner user={user} />}
          <Outlet />
        </main>
      </div>
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
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-success" element={<VerifySuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/2fa" element={<TwoFactor />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<Protected />}>
          <Route element={<AppLayout />}>
            <Route index element={<div>Welcome to AfyaLink HRMS 🚀</div>} />
            <Route path="patient" element={<PatientDashboard />} />
            <Route path="doctor" element={<DoctorDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="*" element={<div>404 — Page not found</div>} />
          </Route>
        </Route>
      </Routes>
    </SocketProvider>
  );
}
