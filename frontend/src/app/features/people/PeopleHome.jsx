import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import HRManagerDashboard from "../../../pages/HRManager/Dashboard";
import PayrollOfficerDashboard from "../../../pages/PayrollOfficer/Dashboard";
import StaffDashboard from "../../../pages/Staff/Dashboard";

export default function PeopleHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "HR_MANAGER") return <HRManagerDashboard />;
  if (role === "PAYROLL_OFFICER") return <PayrollOfficerDashboard />;

  return <StaffDashboard />;
}

