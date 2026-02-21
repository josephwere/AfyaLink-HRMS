import mongoose from "mongoose";
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
      ],
      default: "Scheduled",
      index: true,
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
appointmentSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
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
