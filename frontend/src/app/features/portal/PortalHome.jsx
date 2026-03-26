import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import PatientDashboard from "../../../pages/Patient/Dashboard";
import GuestDashboard from "../../../pages/GuestDashboard";

export default function PortalHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "GUEST") return <GuestDashboard />;
  return <PatientDashboard />;
}

