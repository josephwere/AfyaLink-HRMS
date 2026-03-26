import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import SuperAdminDashboard from "../../../pages/SuperAdmin/Dashboard";
import DeveloperDashboard from "../../../pages/Developer/Dashboard";
import SystemAdminDashboard from "../../../pages/SystemAdmin/Dashboard";
import UnifiedAssistantDashboard from "../../../pages/SystemAdmin/UnifiedAssistantDashboard";
import SecurityOfficerDashboard from "../../../pages/Security/OfficerDashboard";
import SecurityAdminDashboard from "../../../pages/Security/AdminDashboard";

export default function PlatformHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "SUPER_ADMIN") return <SuperAdminDashboard />;
  if (role === "DEVELOPER") return <DeveloperDashboard />;
  if (role === "SYSTEM_ADMIN") return <SystemAdminDashboard />;
  if (role === "SUPER_ASSISTANT") return <UnifiedAssistantDashboard />;
  if (role === "SECURITY_OFFICER") return <SecurityOfficerDashboard />;
  if (role === "SECURITY_ADMIN") return <SecurityAdminDashboard />;

  return <SuperAdminDashboard />;
}

