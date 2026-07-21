export function getVisibleHospitals(hospitals = [], expanded = false, defaultLimit = 3) {
  const rows = Array.isArray(hospitals) ? hospitals : [];
  if (expanded) return rows;
  return rows.slice(0, Math.max(0, defaultLimit));
}

export function getAppointmentFlowStage(state = {}) {
  const hasSelection = Boolean(state?.selectedHospital);
  const hasDoctor = Boolean(state?.selectedDoctor);
  const hasAppointment = Boolean(state?.appointmentReady || state?.bookingSuccess);
  if (!hasSelection) return 1;
  if (!hasDoctor) return 2;
  if (!hasAppointment) return 3;
  return 4;
}
