/**
 * Arrival
 *
 * Records the patient's arrival and check-in process.
 * Bridge between Appointment and Encounter.
 * Works for both in-person and telemedicine.
 */

import mongoose from "mongoose";

const arrivalSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
      index: true,
    },

    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      sparse: true,
    },

    /* ==============================
       SCHEDULING CONTEXT
    ============================== */
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    consultationMode: {
      type: String,
      enum: ["IN_PERSON", "CHAT", "VOICE", "VIDEO"],
      default: "IN_PERSON",
    },

    /* ==============================
       STATE TRACKING
    ============================== */
    status: {
      type: String,
      enum: [
        "BOOKED",
        "ARRIVED",
        "VERIFIED",
        "WAITING",
        "CALLED",
        "READY",
        "ENCOUNTER_OPENING",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
        "LATE_NO_SHOW",
        "RESCHEDULED",
      ],
      default: "BOOKED",
      index: true,
    },

    /* ==============================
       ARRIVAL DETAILS
    ============================== */
    arrivedAt: {
      type: Date,
      sparse: true,
    },

    arrivalMethod: {
      type: String,
      enum: ["QR_SCAN", "MANUAL_CHECK_IN", "VIDEO_JOIN", "WALK_IN"],
      sparse: true,
    },

    arrivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    minutesEarly: {
      type: Number,
      default: 0,
    },

    minutesLate: {
      type: Number,
      default: 0,
    },

    /* ==============================
       IDENTITY VERIFICATION
    ============================== */
    verifiedAt: {
      type: Date,
      sparse: true,
    },

    verificationMethod: {
      type: String,
      enum: ["QR_CODE", "NATIONAL_ID", "PASSPORT", "FACE_RECOGNITION", "VOICE"],
      sparse: true,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    verifiedPatient: {
      patientId: mongoose.Schema.Types.ObjectId,
      name: String,
    },

    /* ==============================
       QUEUE MANAGEMENT
    ============================== */
    waitingSince: {
      type: Date,
      sparse: true,
    },

    queuePosition: {
      type: Number,
      default: 0,
    },

    waitingDurationMins: {
      type: Number,
      sparse: true,
    },

    /* ==============================
       CLINICIAN COORDINATION
    ============================== */
    calledAt: {
      type: Date,
      sparse: true,
    },

    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    readyAt: {
      type: Date,
      sparse: true,
    },

    readyBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    /* ==============================
       ENCOUNTER HANDOFF
    ============================== */
    encounterRequestedAt: {
      type: Date,
      sparse: true,
    },

    completedAt: {
      type: Date,
      sparse: true,
    },

    /* ==============================
       NO-SHOW & CANCELLATION
    ============================== */
    noShowAt: {
      type: Date,
      sparse: true,
    },

    noShowReportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    noShowReason: {
      type: String,
      sparse: true,
    },

    cancelledAt: {
      type: Date,
      sparse: true,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    cancellationReason: {
      type: String,
      sparse: true,
    },

    /* ==============================
       METADATA
    ============================== */
    timezone: {
      type: String,
      default: "UTC",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      sparse: true,
    },
  },
  {
    timestamps: true,
    collection: "arrivals",
  }
);

// Indexes for common queries
arrivalSchema.index({ appointment: 1, patient: 1 });
arrivalSchema.index({ doctor: 1, status: 1 }); // For doctor queue
arrivalSchema.index({ hospital: 1, status: 1 }); // For hospital dashboard
arrivalSchema.index({ scheduledAt: 1, status: 1 }); // For daily reports
arrivalSchema.index({ createdAt: -1 }); // For recent arrivals

const Arrival = mongoose.model("Arrival", arrivalSchema);

export default Arrival;
