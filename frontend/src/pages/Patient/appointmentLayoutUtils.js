export function getVisibleHospitals(hospitals = [], expanded = false, defaultLimit = 3) {
  const rows = Array.isArray(hospitals) ? hospitals : [];
  if (expanded) return rows;
  return rows.slice(0, Math.max(0, defaultLimit));
}

export function getAppointmentFlowStage(state = {}) {
  const hasSelection = Boolean(state?.selectedHospital);
  const hasService = Boolean(state?.selectedService || state?.serviceType);
  const hasAppointment = Boolean(state?.appointmentReady || state?.bookingSuccess);
  if (!hasSelection) return 1;
  if (!hasService) return 2;
  if (!hasAppointment) return 3;
  return 4;
}
