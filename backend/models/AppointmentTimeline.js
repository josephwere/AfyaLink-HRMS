/**
 * AppointmentTimeline
 *
 * Immutable record of every state transition, action, and event
 * in an appointment's lifecycle.
 *
 * Used for:
 * - Audit trails
 * - Operational reporting
 * - SLA monitoring
 * - Patient support (what happened when)
 * - Debugging
 * - AI summaries
 */

import mongoose from "mongoose";

const appointmentTimelineSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },

    // The action/state that was recorded
    action: {
      type: String,
      enum: [
        "CREATED",
        "CONFIRMED",
        "CHECKED_IN",
        "WAITING",
        "READY_FOR_PROVIDER",
        "OPENING_ENCOUNTER",
        "IN_ENCOUNTER",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
        "NO_SHOW",
        "RESCHEDULED",
      ],
      required: true,
    },

    // Who made this action
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    // Role of the actor (ADMIN, DOCTOR, NURSE, RECEPTIONIST, SYSTEM, PATIENT)
    actorRole: {
      type: String,
      enum: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "SYSTEM", "PATIENT"],
      sparse: true,
    },

    // When this action occurred
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // Timezone of the actor (for localized reporting)
    timezone: {
      type: String,
      default: "UTC",
    },

    // Flexible metadata for each action type
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      sparse: true,
    },

    // For tracking durations or intervals
    durationMins: Number,
    minutesLate: Number,
    waitingDurationMins: Number,
    actualDurationMins: Number,

    // For state-specific fields
    cancelReason: String,
    noShowReportedBy: mongoose.Schema.Types.ObjectId,
    rescheduledFrom: Date,
    rescheduledTo: Date,
    checkedInBy: mongoose.Schema.Types.ObjectId,
    confirmedBy: mongoose.Schema.Types.ObjectId,
    cancelledBy: mongoose.Schema.Types.ObjectId,
    providerReadyBy: mongoose.Schema.Types.ObjectId,

    // For encounter correlation
    encounterId: mongoose.Schema.Types.ObjectId,

    // For structured notes
    notes: String,

    // For integration with external systems
    externalReference: {
      system: String,
      id: String,
    },

    // For tracking which operation this came from
    operationId: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: false, // No automatic createdAt/updatedAt; we track explicitly with timestamp
    collection: "appointmentTimelines",
  }
);

// Composite index for patient + appointment queries
appointmentTimelineSchema.index({ appointment: 1, timestamp: 1 });

// Index for operational reporting (find all appointments checked in on a date)
appointmentTimelineSchema.index({ action: 1, timestamp: 1 });

// Index for audit (find all actions by an actor)
appointmentTimelineSchema.index({ actor: 1, timestamp: 1 });

// Make the schema immutable after creation
appointmentTimelineSchema.pre("save", function (next) {
  if (!this.isNew) {
    throw new Error("AppointmentTimeline entries are immutable.");
  }
  next();
});

const AppointmentTimeline = mongoose.model("AppointmentTimeline", appointmentTimelineSchema);

export default AppointmentTimeline;
