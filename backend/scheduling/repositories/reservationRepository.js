import SlotReservation from "../../models/SlotReservation.js";
import { SLOT_STATES } from "../runtime/slotStateMachine.js";

export async function createReservation({
  appointmentId,
  patientId,
  hospitalId,
  doctorId,
  scheduledAt,
  durationMins,
  holdSeconds = 30,
  createdBy,
  session = null,
}) {
  const expiresAt = new Date(Date.now() + Math.max(holdSeconds, 5) * 1000);
  const reservation = new SlotReservation({
    appointment: appointmentId,
    patient: patientId,
    hospital: hospitalId,
    doctor: doctorId,
    scheduledAt,
    durationMins,
    expiresAt,
    status: SLOT_STATES.HELD,
    createdBy,
  });
  return reservation.save({ session });
}

export async function findActiveReservation({ patientId, doctorId, scheduledAt, session = null }) {
  return SlotReservation.findOne({
    patient: patientId,
    doctor: doctorId,
    scheduledAt,
    status: { $in: [SLOT_STATES.HELD, SLOT_STATES.CONFIRMED] },
  }).session(session || null).lean();
}

export async function transitionReservationStatus(reservationId, nextStatus, session = null) {
  const reservation = await SlotReservation.findById(reservationId).session(session || null);
  if (!reservation) throw new Error("Reservation not found");
  reservation.status = nextStatus;
  if (nextStatus === SLOT_STATES.EXPIRED || nextStatus === SLOT_STATES.CANCELLED) {
    reservation.expiresAt = new Date();
  }
  return reservation.save({ session });
}
