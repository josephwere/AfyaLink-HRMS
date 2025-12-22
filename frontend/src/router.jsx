import { Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import RoleRoute from "./RoleRoute";

/* Dashboards */
import Dashboard from "./pages/Dashboard";
import PharmacyDashboard from "./pages/Pharmacy/PharmacyDashboard";
import Inventory from "./pages/Inventory";
import Lab from "./pages/Lab";
import Audit from "./pages/Audit";

export default function Router() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* =====================
            GENERAL DASHBOARD
        ====================== */}
        <Route
          path="/"
          element={
            <RoleRoute roles={["SuperAdmin", "HospitalAdmin"]}>
              <Dashboard />
            </RoleRoute>
          }
        />

        {/* =====================
            PHARMACIST
        ====================== */}
        <Route
          path="/pharmacy/dashboard"
          element={
            <RoleRoute roles={["Pharmacist"]}>
              <PharmacyDashboard />
            </RoleRoute>
          }
        />

        <Route
          path="/pharmacy/inventory"
          element={
            <RoleRoute roles={["Pharmacist"]}>
              <Inventory />
            </RoleRoute>
          }
        />

        {/* =====================
            LAB
        ====================== */}
        <Route
          path="/lab/dashboard"
          element={
            <RoleRoute roles={["LabTech"]}>
              <Lab />
            </RoleRoute>
          }
        />
        {/* =====================
            LAB
        ====================== */}
        <Route
          
          {
  path: "/admin/audit",
  element: (
    <RoleRoute roles={["SUPER_ADMIN", "HOSPITAL_ADMIN"]}>
      <AuditLogs />
    </RoleRoute>
  ),
}

        />

        {/* =====================
            AUDIT (RESTRICTED)
        ====================== */}
        <Route
          path="/audit"
          element={
            <RoleRoute roles={["SuperAdmin"]}>
              <Audit />
            </RoleRoute>
          }
        />
      </Route>
    </Routes>
  );
}
