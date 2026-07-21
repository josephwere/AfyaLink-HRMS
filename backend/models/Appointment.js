import mongoose from "mongoose";
import { generateAppointmentId } from "../services/idGenerator.js";
const { Schema, model } = mongoose;

/* ======================================================
   HARD WORKFLOW ASSERTION (NON-NEGOTIABLE)
====================================================== */
function assertWorkflowContext(doc) {
  if (!doc.$locals?.viaWorkflow) {
    throw new Error(
      "SECURITY VIOLATION: Appointment mutation must occur via workflowService"
    );
  }
}

/* ======================================================
   APPOINTMENT SCHEMA (ENTERPRISE-GRADE)
====================================================== */
const appointmentSchema = new Schema(
  {
    /* ==============================
       CORE RELATIONS
    ============================== */
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    doctor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    appointmentId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

    workflowId: {
      type: String,
      index: true,
    },

    /* ==============================
       SCHEDULING
    ============================== */
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    durationMins: {
      type: Number,
      default: 30,
      min: 5,
      max: 480,
    },

    serviceType: {
      type: String,
      trim: true,
      default: "General Consultation",
      index: true,
    },

    consultationMode: {
      type: String,
      enum: ["IN_PERSON", "CHAT", "VOICE", "VIDEO"],
      default: "IN_PERSON",
      index: true,
    },

    appointmentType: {
      type: Schema.Types.ObjectId,
      ref: "AppointmentType",
      sparse: true,
    },

    /* ==============================
       WORKFLOW STATUS
    ============================== */
    status: {
      type: String,
      enum: [
        "Scheduled",
        "CheckedIn",
        "InConsultation",
        "Completed",
        "Cancelled",
        "NoShow",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
        "CREATED",
        "CONFIRMED",
        "CHECKED_IN",
        "WAITING",
        "READY_FOR_PROVIDER",
        "OPENING_ENCOUNTER",
        "IN_ENCOUNTER",
        "EXPIRED",
        "RESCHEDULED",
      ],
      default: "Scheduled",
      index: true,
    },

    assignmentStatus: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "REASSIGNED"],
      default: "PENDING",
      index: true,
    },

    /* ==============================
       LIFECYCLE TIMESTAMPS
    ============================== */
    confirmedAt: {
      type: Date,
      sparse: true,
    },

    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    checkedInAt: {
      type: Date,
      sparse: true,
    },

    checkedInBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    minutesLate: {
      type: Number,
      default: 0,
    },

    waitingSince: {
      type: Date,
      sparse: true,
    },

    waitingDurationMins: {
      type: Number,
      sparse: true,
    },

    providerReadyAt: {
      type: Date,
      sparse: true,
    },

    providerReadyBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    encounterRequestedAt: {
      type: Date,
      sparse: true,
    },

    encounter: {
      type: Schema.Types.ObjectId,
      ref: "Encounter",
      sparse: true,
    },

    encounterStartedAt: {
      type: Date,
      sparse: true,
    },

    completedAt: {
      type: Date,
      sparse: true,
    },

    completionNotes: {
      type: String,
      sparse: true,
    },

    actualDurationMins: {
      type: Number,
      sparse: true,
    },

    expiredAt: {
      type: Date,
      sparse: true,
    },

    noShowAt: {
      type: Date,
      sparse: true,
    },

    noShowReportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    rescheduledAt: {
      type: Date,
      sparse: true,
    },

    rescheduledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    rescheduledFrom: {
      type: Date,
      sparse: true,
    },

    /* ==============================
       CLINICAL CONTEXT
    ============================== */
    reason: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
    },

    /* ==============================
       BILLING & WORKFLOW HOOKS
    ============================== */
    billable: {
      type: Boolean,
      default: true,
    },

    billingId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },

    consultationId: {
      type: Schema.Types.ObjectId,
      ref: "Consultation",
    },

    /* ==============================
       SECURITY & AUDIT
    ============================== */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: {
      type: Date,
    },

    cancellationReason: {
      type: String,
      sparse: true,
    },

    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/* ======================================================
   INDEXES (PERFORMANCE = SCALE)
====================================================== */

// Prevent double booking (doctor)
appointmentSchema.index(
  { doctor: 1, scheduledAt: 1 },
  { name: "doctor_schedule_idx" }
);

// Hospital dashboard fast loads
appointmentSchema.index(
  { hospital: 1, scheduledAt: -1 },
  { name: "hospital_schedule_idx" }
);

// Patient history
appointmentSchema.index(
  { patient: 1, scheduledAt: -1 },
  { name: "patient_history_idx" }
);

// Patient self-service daily booking limit
appointmentSchema.index(
  { patient: 1, createdAt: -1, status: 1 },
  { name: "patient_daily_booking_idx" }
);

// Workflow tracking
appointmentSchema.index(
  { status: 1, scheduledAt: -1 },
  { name: "status_idx" }
);

/* ======================================================
   HARD WORKFLOW ENFORCEMENT
====================================================== */

// CREATE
appointmentSchema.pre("save", function (next) {
  if (this.isNew) {
    assertWorkflowContext(this);
  }

  // Domain rule (allowed)
  if (this.isModified("status") && this.status === "Cancelled") {
    this.cancelledAt = new Date();
  }

  next();
});

// UPDATE (findOneAndUpdate, updateOne, etc.)
appointmentSchema.pre("findOneAndUpdate", async function (next) {
    const options = this.getOptions();
    if (!options.upsert) return next();

    const update = this.getUpdate() || {};
    const hasAppointmentId =
      update.appointmentId !== undefined ||
      (update.$set && update.$set.appointmentId !== undefined) ||
      (update.$setOnInsert && update.$setOnInsert.appointmentId !== undefined);

    if (!hasAppointmentId) {
      const nextId = await generateAppointmentId();
      this.setUpdate({
        ...update,
        $setOnInsert: {
          ...(update.$setOnInsert || {}),
          appointmentId: nextId,
        },
      });
    }

    next();
  });

  appointmentSchema.pre(
    ["updateOne", "updateMany"],
  function (next) {
    if (!this.getOptions()?.viaWorkflow) {
      throw new Error(
        "SECURITY VIOLATION: Appointment update must occur via workflowService"
      );
    }
    next();
  }
);

// DELETE
appointmentSchema.pre(
  ["deleteOne", "findOneAndDelete"],
  function (next) {
    if (!this.getOptions()?.viaWorkflow) {
      throw new Error(
        "SECURITY VIOLATION: Appointment deletion must occur via workflowService"
      );
    }
    next();
  }
);

/* ======================================================
   SAFE EXPORT
====================================================== */
const Appointment =
  mongoose.models.Appointment ||
  model("Appointment", appointmentSchema);

export default Appointment;
