import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import SuperAdminHospitals from "../../../pages/SuperAdmin/Hospitals";
import GovernmentHospitalRegistryPage from "../../../pages/SystemAdmin/GovernmentHospitalRegistry";

export default function HospitalRegistry() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "SUPER_ADMIN") return <SuperAdminHospitals />;
  return <GovernmentHospitalRegistryPage />;
}

