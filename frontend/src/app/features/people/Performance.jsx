import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import DoctorPerformance from "../../../pages/Doctor/Performance";
import NursePerformance from "../../../pages/Nurse/Performance";

export default function Performance() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "NURSE") return <NursePerformance />;
  return <DoctorPerformance />;
}

