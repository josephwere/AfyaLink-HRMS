import "./theme-d.css";
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./utils/auth";
import SocketProvider from "./utils/socket";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Notifications from "./components/Notifications";
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

/* =======================
   DASHBOARDS
======================= */
import DoctorDashboard from "./pages/Doctor/Dashboard";
import PatientDashboard from "./pages/Patient/Dashboard";

/* =======================
   ADMIN
======================= */
import AdminDashboard from "./pages/Admin/Dashboard";
import AuditLogs from "./pages/Admin/AuditLogs";
import CreateAdmin from "./pages/Admin/CreateAdmin";

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
   APP
===================================================== */
export default function App() {
  return (
    <SocketProvider>
      <Routes>
        {/* ================= PUBLIC ================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-success" element={<VerifySuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/2fa" element={<TwoFactor />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* ================= PROTECTED ROOT ================= */}
          <Route
  element={
    <RequireRole>
      <AutoRedirect>
        <AppLayout />
      </AutoRedirect>
    </RequireRole>
  }
>
          {/* Default */}
          <Route index element={<div>Welcome to AfyaLink HRMS 🚀</div>} />

          {/* ================= PATIENT ================= */}
          <Route
            path="patient"
            element={
              <RequireRole roles={["PATIENT"]}>
                <PatientDashboard />
              </RequireRole>
            }
          />

          {/* ================= DOCTOR ================= */}
          <Route
            path="doctor"
            element={
              <RequireRole roles={["DOCTOR"]}>
                <DoctorDashboard />
              </RequireRole>
            }
          />

          {/* ================= ADMIN ================= */}
          <Route
            path="admin"
            element={
              <RequireRole roles={["SUPER_ADMIN", "HOSPITAL_ADMIN"]}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />

            <Route
              path="audit-logs"
              element={
                <RequireRole roles={["SUPER_ADMIN", "HOSPITAL_ADMIN"]}>
                  <AuditLogs />
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

          {/* ================= 404 ================= */}
          <Route path="*" element={<div>404 — Page not found</div>} />
        </Route>
      </Routes>
    </SocketProvider>
  );
             }
