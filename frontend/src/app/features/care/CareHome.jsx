import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import DoctorDashboard from "../../../pages/Doctor/Dashboard";
import NurseDashboard from "../../../pages/Nurse/Dashboard";
import SurgeonDashboard from "../../../pages/Surgeon/Dashboard";
import RadiologistDashboard from "../../../pages/Radiologist/Dashboard";
import TherapistDashboard from "../../../pages/Therapist/Dashboard";

export default function CareHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "DOCTOR") return <DoctorDashboard />;
  if (role === "SURGEON") return <SurgeonDashboard />;
  if (role === "NURSE") return <NurseDashboard />;
  if (role === "RADIOLOGIST") return <RadiologistDashboard />;
  if (role === "THERAPIST") return <TherapistDashboard />;

  // Founder + developer role views can land here.
  return <DoctorDashboard />;
}

