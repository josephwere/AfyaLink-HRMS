import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import DoctorAppointments from "../../../pages/Doctor/Appointments";
import HospitalAdminAppointments from "../../../pages/HospitalAdmin/Appointments";

export default function SchedulingAppointments() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "DOCTOR" || role === "SURGEON") return <DoctorAppointments />;
  return <HospitalAdminAppointments />;
}

