import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import HospitalAdminDashboard from "../../../pages/HospitalAdmin/Dashboard";
import ReceptionistDashboard from "../../../pages/Receptionist/Dashboard";
import CommunityHealthWorkerDashboard from "../../../pages/CommunityHealthWorker/Dashboard";
import LabTechDashboard from "../../../pages/LabTech/Dashboard";
import PharmacyDashboard from "../../../pages/Pharmacy/Index";
import StaffDashboard from "../../../pages/Staff/Dashboard";

export default function OperationsHome() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "HOSPITAL_ADMIN" || role === "HOSPITAL_ADMIN_ASSISTANT") return <HospitalAdminDashboard />;
  if (role === "RECEPTIONIST") return <ReceptionistDashboard />;
  if (role === "COMMUNITY_HEALTH_WORKER") return <CommunityHealthWorkerDashboard />;
  if (role === "LAB_TECH") return <LabTechDashboard />;
  if (role === "PHARMACIST") return <PharmacyDashboard />;
  if (["MAINTENANCE_TECH", "BIOMEDICAL_TECHNICIAN", "HOUSEKEEPING_STAFF", "KITCHEN_STAFF"].includes(role)) {
    return <StaffDashboard />;
  }

  return <StaffDashboard />;
}

