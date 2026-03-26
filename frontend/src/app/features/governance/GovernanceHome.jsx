import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import SystemAdminDashboard from "../../../pages/SystemAdmin/Dashboard";
import GovernmentClaimsDashboard from "../../../pages/SystemAdmin/GovernmentClaimsDashboard";

export default function GovernanceHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role.startsWith("GOVERNMENT_")) return <GovernmentClaimsDashboard />;
  if (role === "SYSTEM_ADMIN") return <SystemAdminDashboard />;

  return <SystemAdminDashboard />;
}

