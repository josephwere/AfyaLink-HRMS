/**
 * ArrivalTimeline
 *
 * Immutable audit trail of every state transition during patient arrival.
 */

import mongoose from "mongoose";

const arrivalTimelineSchema = new mongoose.Schema(
  {
    arrival: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Arrival",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: [
        "CREATED",
        "ARRIVED",
        "VERIFIED",
        "WAITING",
        "CALLED",
        "READY",
        "ENCOUNTER_OPENING",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
      ],
      required: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    actorRole: {
      type: String,
      enum: ["RECEPTIONIST", "NURSE", "DOCTOR", "SYSTEM", "PATIENT"],
      sparse: true,
    },

    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    timezone: {
      type: String,
      default: "UTC",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      sparse: true,
    },

    // For arrival-specific data
    arrivalMethod: String,
    verificationMethod: String,
    queuePosition: Number,
    waitingDurationMins: Number,
    minutesLate: Number,
    minutesEarly: Number,
    reason: String, // For cancellation, no-show

    // For integration
    externalReference: {
      system: String,
      id: String,
    },
  },
  {
    timestamps: false,
    collection: "arrivalTimelines",
  }
);

// Composite indexes
arrivalTimelineSchema.index({ arrival: 1, timestamp: 1 });
arrivalTimelineSchema.index({ action: 1, timestamp: 1 });
arrivalTimelineSchema.index({ actor: 1, timestamp: 1 });

// Immutable
arrivalTimelineSchema.pre("save", function (next) {
  if (!this.isNew) {
    throw new Error("ArrivalTimeline entries are immutable.");
  }
  next();
});

const ArrivalTimeline = mongoose.model("ArrivalTimeline", arrivalTimelineSchema);

export default ArrivalTimeline;
