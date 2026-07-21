export function appointmentContract(appointment) {
  return {
    id: appointment.id || appointment._id,
    patientId: appointment.patient,
    doctorId: appointment.doctor,
    hospitalId: appointment.hospital,
    scheduledAt: appointment.scheduledAt,
    durationMins: appointment.durationMins,
    serviceType: appointment.serviceType,
    consultationMode: appointment.consultationMode,
    status: appointment.status,
    assignmentStatus: appointment.assignmentStatus,
    reason: appointment.reason,
    metadata: appointment.metadata || {},
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}
