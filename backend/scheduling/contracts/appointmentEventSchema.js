export const APPOINTMENT_EVENT_TYPES = Object.freeze({
  BOOKED: "APPOINTMENT_BOOKED",
  ASSIGNED: "APPOINTMENT_ASSIGNED",
  CHECKED_IN: "APPOINTMENT_CHECKED_IN",
  COMPLETED: "APPOINTMENT_COMPLETED",
  CANCELLED: "APPOINTMENT_CANCELLED",
});

export function buildAppointmentEvent(type, payload) {
  return {
    type,
    occurredAt: new Date().toISOString(),
    ...payload,
  };
}
