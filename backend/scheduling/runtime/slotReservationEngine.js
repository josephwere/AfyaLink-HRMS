import SlotReservation from "../../models/SlotReservation.js";
import { SLOT_STATES, canTransitionSlot } from "./slotStateMachine.js";

export async function createSlotReservation({ appointmentId, patientId, hospitalId, doctorId, scheduledAt, durationMins, holdSeconds = 30, createdBy }) {
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
  return reservation.save();
}

export async function transitionReservationStatus(reservationId, nextStatus) {
  const reservation = await SlotReservation.findById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (!canTransitionSlot(reservation.status, nextStatus)) {
    throw new Error(`Invalid reservation transition from ${reservation.status} to ${nextStatus}`);
  }
  reservation.status = nextStatus;
  if (nextStatus === SLOT_STATES.EXPIRED || nextStatus === SLOT_STATES.CANCELLED) {
    reservation.expiresAt = new Date();
  }
  return reservation.save();
}

export async function expireHeldReservations() {
  const now = new Date();
  await SlotReservation.updateMany({ status: SLOT_STATES.HELD, expiresAt: { $lte: now } }, { status: SLOT_STATES.EXPIRED });
}

export async function findActiveReservation({ patientId, doctorId, scheduledAt }) {
  return SlotReservation.findOne({
    patient: patientId,
    doctor: doctorId,
    scheduledAt,
    status: { $in: [SLOT_STATES.HELD, SLOT_STATES.CONFIRMED] },
  }).lean();
}
