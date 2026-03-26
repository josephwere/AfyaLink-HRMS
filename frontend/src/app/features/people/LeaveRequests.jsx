import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import DoctorLeaveRequests from "../../../pages/Doctor/LeaveRequests";
import NurseLeaveRequests from "../../../pages/Nurse/LeaveRequests";

export default function LeaveRequests() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "NURSE") return <NurseLeaveRequests />;
  return <DoctorLeaveRequests />;
}

