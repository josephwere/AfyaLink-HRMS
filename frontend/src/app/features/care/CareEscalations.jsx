import React from "react";
import { useAuth } from "../../../utils/auth";
import { normalizeRole } from "../../../utils/normalizeRole";

import HospitalAdminEscalationQueue from "../../../pages/HospitalAdmin/EscalationQueue";

export default function CareEscalations() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || "");

  if (role === "DOCTOR" || role === "SURGEON") {
    return <HospitalAdminEscalationQueue viewer="doctor" />;
  }

  return <HospitalAdminEscalationQueue />;
}

