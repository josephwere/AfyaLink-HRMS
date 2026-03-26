import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import MyPatients from "../../../pages/Doctor/MyPatients";
import AssignedPatients from "../../../pages/Nurse/AssignedPatients";

export default function CarePatients() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "NURSE") return <AssignedPatients />;
  return <MyPatients />;
}

