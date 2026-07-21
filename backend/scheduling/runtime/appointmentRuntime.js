/**
 * Appointment Runtime
 *
 * Manages the complete lifecycle of an appointment from confirmation until
 * handoff to the Encounter Runtime.
 *
 * Responsibilities:
 * - State transitions with guarded validity
 * - Timeline tracking for audit and operations
 * - Domain event emission for integration
 * - No scheduling, no encounter creation, no clinical workflows
 *
 * Integration points:
 * - Appointment Runtime receives confirmed appointment from Scheduling Runtime
 * - Appointment Runtime emits ENCOUNTER_REQUESTED → Encounter Runtime creates encounter
 * - Appointment Runtime publishes events → other services subscribe
 */

import Appointment from "../../models/Appointment.js";
import AppointmentTimeline from "../../models/AppointmentTimeline.js";
import SlotReservation from "../../models/SlotReservation.js";
import { clockService } from "../../services/clockService.js";
import { EventEmitter } from "events";

const VALID_TRANSITIONS = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "EXPIRED", "NO_SHOW", "RESCHEDULED"],
  CHECKED_IN: ["WAITING", "CANCELLED"],
  WAITING: ["READY_FOR_PROVIDER", "CANCELLED"],
  READY_FOR_PROVIDER: ["OPENING_ENCOUNTER", "CANCELLED"],
  OPENING_ENCOUNTER: ["IN_ENCOUNTER", "CANCELLED"],
  IN_ENCOUNTER: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

export class AppointmentRuntime extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Expire a reservation (worker helper)
   */
  async expireReservation(reservationObj, now = new Date()) {
    if (!reservationObj || !reservationObj._id) {
      throw new Error("Invalid reservation reference");
    }

    const res = await SlotReservation.findById(reservationObj._id);
    if (!res) {
      throw new Error(`SlotReservation not found: ${reservationObj._id}`);
    }

    if (res.status === "HELD" && res.expiresAt <= now) {
      res.status = "EXPIRED";
      await res.save();
    }

    return res;
  }

  setupEventHandlers() {
    // Publish events for notifications, analytics, dashboards, etc.
    this.on("appointmentEvent", (event) => {
      console.log(`[AppointmentRuntime] Event: ${event.code} for appointment ${event.appointmentId}`);
      // In production: publish to message queue, event bus, etc.
    });
  }

  /**
   * Transition helper with guards
   */
  validateTransition(currentStatus, targetStatus) {
    if (!VALID_TRANSITIONS[currentStatus]) {
      throw new Error(`Invalid current status: ${currentStatus}`);
    }

    if (!VALID_TRANSITIONS[currentStatus].includes(targetStatus)) {
      throw new Error(
        `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${VALID_TRANSITIONS[
          currentStatus
        ].join(", ")}`
      );
    }

    return true;
  }

  /**
   * Create appointment timeline entry
   */
  async recordTimelineEntry(appointmentId, action, metadata = {}) {
    const entry = await AppointmentTimeline.create({
      appointment: appointmentId,
      action,
      actor: metadata.actor,
      actorRole: metadata.actorRole,
      metadata,
      timestamp: clockService.nowUTC(),
      timezone: metadata.timezone || "UTC",
    });

    return entry;
  }

  /**
   * Publish domain event
   */
  emitEvent(appointmentId, code, details = {}) {
    const event = {
      appointmentId,
      code,
      timestamp: clockService.nowUTC(),
      ...details,
    };

    this.emit("appointmentEvent", event);
  }

  /**
   * CREATED → CONFIRMED
   * Called after Scheduling Runtime reserves and confirms resources
   */
  async confirmAppointment(appointmentId, confirmedBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "CONFIRMED");

    appointment.status = "CONFIRMED";
    appointment.confirmedAt = clockService.nowUTC();
    appointment.confirmedBy = confirmedBy;
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "CONFIRMED", {
      actor: confirmedBy,
      ...metadata,
    });

    this.emitEvent(appointmentId, "APPOINTMENT_CONFIRMED", {
      confirmedAt: appointment.confirmedAt,
      scheduledAt: appointment.scheduledAt,
    });

    return appointment;
  }

  /**
   * CONFIRMED → CHECKED_IN
   * Patient has arrived and verified identity
   */
  async checkIn(appointmentId, checkedInBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "CHECKED_IN");

    const now = clockService.nowUTC();
    const scheduledTime = new Date(appointment.scheduledAt);
    const minutesLate = Math.max(0, (now - scheduledTime) / 60000);

    appointment.status = "CHECKED_IN";
    appointment.checkedInAt = now;
    appointment.checkedInBy = checkedInBy;
    appointment.minutesLate = minutesLate;
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "CHECKED_IN", {
      actor: checkedInBy,
      minutesLate,
      ...metadata,
    });

    this.emitEvent(appointmentId, "PATIENT_CHECKED_IN", {
      checkedInAt: now,
      minutesLate,
    });

    return appointment;
  }

  /**
   * CHECKED_IN → WAITING
   * Patient is in the waiting area
   */
  async moveToWaiting(appointmentId, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "WAITING");

    appointment.status = "WAITING";
    appointment.waitingSince = clockService.nowUTC();
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "WAITING", metadata);

    this.emitEvent(appointmentId, "PATIENT_WAITING", {
      waitingSince: appointment.waitingSince,
    });

    return appointment;
  }

  /**
   * WAITING → READY_FOR_PROVIDER
   * Provider is ready; patient will be called to consultation
   */
  async markProviderReady(appointmentId, readyBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "READY_FOR_PROVIDER");

    appointment.status = "READY_FOR_PROVIDER";
    appointment.providerReadyAt = clockService.nowUTC();
    appointment.providerReadyBy = readyBy;

    if (appointment.waitingSince) {
      appointment.waitingDurationMins = (appointment.providerReadyAt - appointment.waitingSince) / 60000;
    }

    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "READY_FOR_PROVIDER", {
      actor: readyBy,
      waitingDurationMins: appointment.waitingDurationMins,
      ...metadata,
    });

    this.emitEvent(appointmentId, "PROVIDER_READY", {
      readyAt: appointment.providerReadyAt,
      waitingDurationMins: appointment.waitingDurationMins,
    });

    return appointment;
  }

  /**
   * READY_FOR_PROVIDER → OPENING_ENCOUNTER
   * Appointment Runtime initiates encounter creation
   * Does NOT create encounter itself; delegates to Encounter Runtime
   */
  async launchEncounter(appointmentId, launchMetadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "OPENING_ENCOUNTER");

    appointment.status = "OPENING_ENCOUNTER";
    appointment.encounterRequestedAt = clockService.nowUTC();
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "OPENING_ENCOUNTER", launchMetadata);

    // Emit event for Encounter Runtime to subscribe
    this.emitEvent(appointmentId, "ENCOUNTER_REQUESTED", {
      appointmentId: String(appointment._id),
      patientId: String(appointment.patient),
      doctorId: appointment.doctor ? String(appointment.doctor) : null,
      hospitalId: String(appointment.hospital),
      consultationMode: appointment.consultationMode,
      appointmentType: appointment.appointmentType,
      scheduledAt: appointment.scheduledAt,
      metadata: launchMetadata,
    });

    return appointment;
  }

  /**
   * OPENING_ENCOUNTER → IN_ENCOUNTER
   * Encounter Runtime has created encounter; appointment acknowledges
   */
  async confirmEncounterOpened(appointmentId, encounterId, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    if (appointment.status !== "OPENING_ENCOUNTER") {
      throw new Error(`Appointment must be in OPENING_ENCOUNTER state, current: ${appointment.status}`);
    }

    appointment.status = "IN_ENCOUNTER";
    appointment.encounter = encounterId;
    appointment.encounterStartedAt = clockService.nowUTC();
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "IN_ENCOUNTER", {
      encounterId,
      ...metadata,
    });

    this.emitEvent(appointmentId, "ENCOUNTER_OPENED", {
      encounterId,
      startedAt: appointment.encounterStartedAt,
    });

    return appointment;
  }

  /**
   * IN_ENCOUNTER → COMPLETED
   * Appointment has run to completion
   */
  async complete(appointmentId, completionData = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "COMPLETED");

    appointment.status = "COMPLETED";
    appointment.completedAt = clockService.nowUTC();
    appointment.completionNotes = completionData.notes;

    if (appointment.scheduledAt && appointment.completedAt) {
      const durationMins = (appointment.completedAt - new Date(appointment.scheduledAt)) / 60000;
      appointment.actualDurationMins = durationMins;
    }

    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "COMPLETED", {
      notes: completionData.notes,
      actualDurationMins: appointment.actualDurationMins,
      completedAt: appointment.completedAt,
    });

    this.emitEvent(appointmentId, "APPOINTMENT_COMPLETED", {
      completedAt: appointment.completedAt,
      actualDurationMins: appointment.actualDurationMins,
    });

    return appointment;
  }

  /**
   * CONFIRMED → CANCELLED
   * Appointment explicitly cancelled
   */
  async cancel(appointmentId, reason, cancelledBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "CANCELLED");

    // If checked in, record time spent
    let timeSpentMins = 0;
    if (appointment.checkedInAt) {
      timeSpentMins = (clockService.nowUTC() - appointment.checkedInAt) / 60000;
    }

    appointment.status = "CANCELLED";
    appointment.cancelledAt = clockService.nowUTC();
    appointment.cancelledBy = cancelledBy;
    appointment.cancellationReason = reason;
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "CANCELLED", {
      reason,
      actor: cancelledBy,
      timeSpentMins,
      ...metadata,
    });

    this.emitEvent(appointmentId, "APPOINTMENT_CANCELLED", {
      cancelledAt: appointment.cancelledAt,
      reason,
      timeSpentMins,
    });

    return appointment;
  }

  /**
   * CONFIRMED → EXPIRED
   * Appointment time has passed without check-in
   */
  async expire(appointmentId, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "EXPIRED");

    appointment.status = "EXPIRED";
    appointment.expiredAt = clockService.nowUTC();
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "EXPIRED", metadata);

    this.emitEvent(appointmentId, "APPOINTMENT_EXPIRED", {
      expiredAt: appointment.expiredAt,
      scheduledAt: appointment.scheduledAt,
    });

    return appointment;
  }

  /**
   * CONFIRMED → NO_SHOW
   * Patient did not show up despite appointment
   */
  async markNoShow(appointmentId, reportedBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "NO_SHOW");

    appointment.status = "NO_SHOW";
    appointment.noShowAt = clockService.nowUTC();
    appointment.noShowReportedBy = reportedBy;
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "NO_SHOW", {
      actor: reportedBy,
      ...metadata,
    });

    this.emitEvent(appointmentId, "APPOINTMENT_NO_SHOW", {
      noShowAt: appointment.noShowAt,
      scheduledAt: appointment.scheduledAt,
    });

    return appointment;
  }

  /**
   * CONFIRMED → RESCHEDULED
   * Appointment moved to different time
   */
  async reschedule(appointmentId, newScheduledAt, rescheduledBy, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    await this.validateTransition(appointment.status, "RESCHEDULED");

    const originalScheduledAt = appointment.scheduledAt;

    appointment.status = "RESCHEDULED";
    appointment.rescheduledAt = clockService.nowUTC();
    appointment.rescheduledBy = rescheduledBy;
    appointment.rescheduledFrom = originalScheduledAt;
    appointment.scheduledAt = newScheduledAt;
    await appointment.save();

    await this.recordTimelineEntry(appointmentId, "RESCHEDULED", {
      actor: rescheduledBy,
      originalScheduledAt,
      newScheduledAt,
      ...metadata,
    });

    this.emitEvent(appointmentId, "APPOINTMENT_RESCHEDULED", {
      rescheduledAt: appointment.rescheduledAt,
      originalScheduledAt,
      newScheduledAt,
    });

    return appointment;
  }

  /**
   * Get appointment with full timeline
   */
  async getAppointmentWithTimeline(appointmentId) {
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "_id name email")
      .populate("doctor", "_id name email")
      .populate("hospital", "_id name");

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    const timeline = await AppointmentTimeline.find({ appointment: appointmentId })
      .sort({ timestamp: 1 })
      .lean();

    return {
      appointment,
      timeline,
    };
  }

  /**
   * Get all appointments for a patient on a date
   */
  async getPatientAppointmentsForDate(patientId, date, timeZone = "UTC") {
    const dayStart = clockService.startOfDayInTimezone(date, timeZone);
    const dayEnd = clockService.endOfDayInTimezone(date, timeZone);

    const appointments = await Appointment.find({
      patient: patientId,
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select("_id scheduledAt status consultationMode doctor")
      .lean();

    return appointments;
  }
}

// Export singleton
export const appointmentRuntime = new AppointmentRuntime();
