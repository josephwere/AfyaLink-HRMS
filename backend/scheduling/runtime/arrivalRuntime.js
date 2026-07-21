/**
 * Arrival Runtime
 *
 * Manages the operational workflow between appointment confirmation and
 * encounter launch. Handles patient check-in, identity verification, queue
 * management, and late arrival decisions.
 *
 * This runtime bridges Appointment Runtime and Encounter Runtime.
 * It works for both in-person visits and telemedicine appointments.
 *
 * State Machine:
 * BOOKED (from Appointment Runtime)
 *   ↓
 * ARRIVED (patient physically or digitally present)
 *   ↓
 * VERIFIED (identity confirmed)
 *   ↓
 * WAITING (in queue)
 *   ↓
 * CALLED (clinician ready, patient notified)
 *   ↓
 * READY (both parties present and ready)
 *   ↓
 * ENCOUNTER_OPENING (transitioning to Encounter Runtime)
 *
 * Side exits:
 * - CANCELLED (patient cancels)
 * - NO_SHOW (appointment time passed, patient didn't arrive)
 * - LATE_NO_SHOW (patient arrived after rescheduling deadline)
 * - RESCHEDULED (patient moved to different time)
 */

import Arrival from "../../models/Arrival.js";
import ArrivalTimeline from "../../models/ArrivalTimeline.js";
import Appointment from "../../models/Appointment.js";
import Patient from "../../models/Patient.js";
import { clockService } from "../../services/clockService.js";
import { EventEmitter } from "events";

const VALID_TRANSITIONS = {
  BOOKED: ["ARRIVED", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
  ARRIVED: ["VERIFIED", "CANCELLED"],
  VERIFIED: ["WAITING", "CANCELLED"],
  WAITING: ["CALLED", "CANCELLED"],
  CALLED: ["READY", "CANCELLED"],
  READY: ["ENCOUNTER_OPENING", "CANCELLED"],
  ENCOUNTER_OPENING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  LATE_NO_SHOW: [],
  RESCHEDULED: [],
};

export class ArrivalRuntime extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on("arrivalEvent", (event) => {
      console.log(`[ArrivalRuntime] Event: ${event.code} for arrival ${event.arrivalId}`);
    });
  }

  /**
   * Transition helper with guards
   */
  async validateTransition(currentStatus, targetStatus) {
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
   * Create arrival record when appointment is confirmed
   * Called by Appointment Runtime after CONFIRMED state
   */
  async createArrival(appointmentId, metadata = {}) {
    const appointment = await Appointment.findById(appointmentId)
      .select("_id patient doctor hospital scheduledAt consultationMode")
      .lean();

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    const arrival = await Arrival.create({
      appointment: appointmentId,
      patient: appointment.patient,
      doctor: appointment.doctor,
      hospital: appointment.hospital,
      scheduledAt: appointment.scheduledAt,
      consultationMode: appointment.consultationMode,
      status: "BOOKED",
      createdAt: clockService.nowUTC(),
      timezone: metadata.timezone || "UTC",
      metadata,
    });

    await this.recordTimelineEntry(arrival._id, "CREATED", {
      appointmentId,
      ...metadata,
    });

    this.emitEvent(arrival._id, "ARRIVAL_CREATED", {
      appointmentId,
      scheduledAt: appointment.scheduledAt,
      consultationMode: appointment.consultationMode,
    });

    return arrival;
  }

  /**
   * Record timeline entry
   */
  async recordTimelineEntry(arrivalId, action, metadata = {}) {
    const entry = await ArrivalTimeline.create({
      arrival: arrivalId,
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
   * Emit domain event
   */
  emitEvent(arrivalId, code, details = {}) {
    const event = {
      arrivalId,
      code,
      timestamp: clockService.nowUTC(),
      ...details,
    };

    this.emit("arrivalEvent", event);
  }

  /**
   * BOOKED → ARRIVED
   * Patient physically or digitally arrived
   * Supports both in-person (QR scan) and telemedicine (joined meeting)
   */
  async recordArrival(arrivalId, arrivalMethod, arrivedBy, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "ARRIVED");

    const now = clockService.nowUTC();
    const scheduledTime = new Date(arrival.scheduledAt);
    const minutesEarly = Math.max(0, (scheduledTime - now) / 60000);
    const minutesLate = Math.max(0, (now - scheduledTime) / 60000);

    arrival.status = "ARRIVED";
    arrival.arrivedAt = now;
    arrival.arrivalMethod = arrivalMethod; // QR_SCAN, MANUAL_CHECK_IN, VIDEO_JOIN, WALK_IN
    arrival.arrivedBy = arrivedBy;
    arrival.minutesEarly = minutesEarly > 0 ? minutesEarly : 0;
    arrival.minutesLate = minutesLate > 0 ? minutesLate : 0;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "ARRIVED", {
      actor: arrivedBy,
      arrivalMethod,
      minutesEarly: arrival.minutesEarly,
      minutesLate: arrival.minutesLate,
      ...metadata,
    });

    this.emitEvent(arrivalId, "PATIENT_ARRIVED", {
      arrivalMethod,
      minutesEarly: arrival.minutesEarly,
      minutesLate: arrival.minutesLate,
    });

    return arrival;
  }

  /**
   * ARRIVED → VERIFIED
   * Identity confirmed via QR code, patient ID, or telemedicine presence
   */
  async verifyIdentity(arrivalId, verificationMethod, verifiedBy, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "VERIFIED");

    // Verify patient exists and matches
    const patient = await Patient.findById(arrival.patient).select("_id firstName lastName");
    if (!patient) {
      throw new Error("Patient not found");
    }

    arrival.status = "VERIFIED";
    arrival.verifiedAt = clockService.nowUTC();
    arrival.verificationMethod = verificationMethod; // QR_CODE, NATIONAL_ID, PASSPORT, FACE_RECOGNITION, VOICE
    arrival.verifiedBy = verifiedBy;
    arrival.verifiedPatient = {
      patientId: String(patient._id),
      name: `${patient.firstName} ${patient.lastName}`,
    };
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "VERIFIED", {
      actor: verifiedBy,
      verificationMethod,
      patientName: arrival.verifiedPatient.name,
      ...metadata,
    });

    this.emitEvent(arrivalId, "IDENTITY_VERIFIED", {
      verificationMethod,
      patientId: String(patient._id),
    });

    return arrival;
  }

  /**
   * VERIFIED → WAITING
   * Patient enters queue
   */
  async moveToWaiting(arrivalId, queuePosition, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "WAITING");

    arrival.status = "WAITING";
    arrival.waitingSince = clockService.nowUTC();
    arrival.queuePosition = queuePosition || 0;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "WAITING", {
      queuePosition,
      ...metadata,
    });

    this.emitEvent(arrivalId, "PATIENT_WAITING", {
      queuePosition,
      waitingSince: arrival.waitingSince,
    });

    return arrival;
  }

  /**
   * WAITING → CALLED
   * Clinician is ready; patient is notified to proceed
   */
  async callPatient(arrivalId, calledBy, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "CALLED");

    const now = clockService.nowUTC();
    let waitingDurationMins = 0;
    if (arrival.waitingSince) {
      waitingDurationMins = (now - arrival.waitingSince) / 60000;
    }

    arrival.status = "CALLED";
    arrival.calledAt = now;
    arrival.calledBy = calledBy;
    arrival.waitingDurationMins = waitingDurationMins;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "CALLED", {
      actor: calledBy,
      waitingDurationMins,
      ...metadata,
    });

    this.emitEvent(arrivalId, "PATIENT_CALLED", {
      calledAt: now,
      waitingDurationMins,
      consultationMode: arrival.consultationMode,
    });

    return arrival;
  }

  /**
   * CALLED → READY
   * Both patient and clinician ready; encounter is about to start
   */
  async markReady(arrivalId, readyBy, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "READY");

    arrival.status = "READY";
    arrival.readyAt = clockService.nowUTC();
    arrival.readyBy = readyBy;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "READY", {
      actor: readyBy,
      ...metadata,
    });

    this.emitEvent(arrivalId, "APPOINTMENT_READY", {
      readyAt: arrival.readyAt,
    });

    return arrival;
  }

  /**
   * READY → ENCOUNTER_OPENING
   * Arrival is complete; trigger encounter creation
   */
  async openEncounter(arrivalId, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "ENCOUNTER_OPENING");

    arrival.status = "ENCOUNTER_OPENING";
    arrival.encounterRequestedAt = clockService.nowUTC();
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "ENCOUNTER_OPENING", metadata);

    // Emit event for Encounter Runtime to subscribe
    this.emitEvent(arrivalId, "ENCOUNTER_REQUESTED", {
      appointmentId: String(arrival.appointment),
      patientId: String(arrival.patient),
      doctorId: arrival.doctor ? String(arrival.doctor) : null,
      consultationMode: arrival.consultationMode,
      arrivalData: {
        arrivedAt: arrival.arrivedAt,
        verifiedAt: arrival.verifiedAt,
        waitingDurationMins: arrival.waitingDurationMins,
      },
    });

    return arrival;
  }

  /**
   * ENCOUNTER_OPENING → COMPLETED
   * Encounter Runtime confirms it has opened the encounter
   */
  async confirmEncounterOpened(arrivalId, encounterId, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    if (arrival.status !== "ENCOUNTER_OPENING") {
      throw new Error(`Arrival must be in ENCOUNTER_OPENING state, current: ${arrival.status}`);
    }

    arrival.status = "COMPLETED";
    arrival.encounter = encounterId;
    arrival.completedAt = clockService.nowUTC();
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "COMPLETED", {
      encounterId,
      ...metadata,
    });

    this.emitEvent(arrivalId, "ARRIVAL_COMPLETED", {
      encounterId,
    });

    return arrival;
  }

  /**
   * BOOKED → NO_SHOW
   * Appointment time passed; patient didn't arrive
   */
  async markNoShow(arrivalId, reportedBy, reason, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "NO_SHOW");

    arrival.status = "NO_SHOW";
    arrival.noShowAt = clockService.nowUTC();
    arrival.noShowReportedBy = reportedBy;
    arrival.noShowReason = reason;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "NO_SHOW", {
      actor: reportedBy,
      reason,
      ...metadata,
    });

    this.emitEvent(arrivalId, "PATIENT_NO_SHOW", {
      noShowAt: arrival.noShowAt,
      reason,
    });

    return arrival;
  }

  /**
   * Any state → CANCELLED
   */
  async cancel(arrivalId, reason, cancelledBy, metadata = {}) {
    const arrival = await Arrival.findById(arrivalId);
    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    await this.validateTransition(arrival.status, "CANCELLED");

    arrival.status = "CANCELLED";
    arrival.cancelledAt = clockService.nowUTC();
    arrival.cancelledBy = cancelledBy;
    arrival.cancellationReason = reason;
    await arrival.save();

    await this.recordTimelineEntry(arrivalId, "CANCELLED", {
      actor: cancelledBy,
      reason,
      ...metadata,
    });

    this.emitEvent(arrivalId, "ARRIVAL_CANCELLED", {
      reason,
    });

    return arrival;
  }

  /**
   * Get arrival with full timeline
   */
  async getArrivalWithTimeline(arrivalId) {
    const arrival = await Arrival.findById(arrivalId)
      .populate("patient", "_id firstName lastName")
      .populate("doctor", "_id firstName lastName")
      .populate("hospital", "_id name");

    if (!arrival) {
      throw new Error(`Arrival not found: ${arrivalId}`);
    }

    const timeline = await ArrivalTimeline.find({ arrival: arrivalId })
      .sort({ timestamp: 1 })
      .lean();

    return {
      arrival,
      timeline,
    };
  }

  /**
   * Get waiting queue for a doctor
   */
  async getDoctorQueue(doctorId) {
    const queue = await Arrival.find({
      doctor: doctorId,
      status: { $in: ["WAITING", "CALLED", "READY"] },
    })
      .populate("patient", "_id firstName lastName")
      .select("_id patient status queuePosition waitingSince calledAt")
      .sort({ queuePosition: 1 })
      .lean();

    return queue;
  }

  /**
   * Get hospital-wide waiting statistics
   */
  async getWaitingStats(hospitalId) {
    const stats = await Arrival.aggregate([
      {
        $match: {
          hospital: hospitalId,
          status: { $in: ["WAITING", "CALLED"] },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgWaitingMins: { $avg: "$waitingDurationMins" },
        },
      },
    ]);

    return stats;
  }
}

// Export singleton
export const arrivalRuntime = new ArrivalRuntime();
