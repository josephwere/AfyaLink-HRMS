import mongoose from "mongoose";

const { Schema, model } = mongoose;

/**
 * AppointmentType
 *
 * Defines the characteristics of a type of appointment.
 * Examples: Video Consultation, Minor Surgery, Follow-up, Procedure, Therapy Session
 *
 * This allows the system to:
 * - Calculate slot duration automatically
 * - Define pre/post buffers
 * - Specify resource requirements
 * - Enforce required staff roles
 * - Apply clinical workflows
 * - Track billing codes
 * - Provide preparation instructions
 */

const appointmentTypeSchema = new Schema(
  {
    /* ==============================
       IDENTIFICATION
    ============================== */
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
    },

    /* ==============================
       SCHEDULING PARAMETERS
    ============================== */
    durationMins: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
      default: 30,
    },

    minDurationMins: {
      type: Number,
      min: 5,
      max: 480,
      default: 15,
    },

    maxDurationMins: {
      type: Number,
      min: 5,
      max: 480,
      default: 120,
    },

    preBufferMins: {
      type: Number,
      default: 5,
      min: 0,
      max: 60,
    },

    postBufferMins: {
      type: Number,
      default: 5,
      min: 0,
      max: 60,
    },

    /* ==============================
       CONSULTATION MODES
    ============================== */
    supportedModes: {
      type: [String],
      enum: ["IN_PERSON", "CHAT", "VOICE", "VIDEO"],
      default: ["IN_PERSON"],
    },

    defaultMode: {
      type: String,
      enum: ["IN_PERSON", "CHAT", "VOICE", "VIDEO"],
      default: "IN_PERSON",
    },

    /* ==============================
       RESOURCE REQUIREMENTS
    ============================== */
    requiredResources: [
      {
        resourceType: {
          type: String,
          required: true,
          trim: true,
          // Examples: DOCTOR, NURSE, ROOM, ULTRASOUND, OPERATING_THEATRE
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        _id: false,
      },
    ],

    requiredRoles: [
      {
        type: String,
        trim: true,
        // Examples: DOCTOR, SURGEON, NURSE, THERAPIST, CARDIOLOGIST
      },
    ],

    /* ==============================
       CLINICAL CONFIGURATION
    ============================== */
    priority: {
      type: String,
      enum: ["URGENT", "HIGH", "NORMAL", "LOW"],
      default: "NORMAL",
      index: true,
    },

    requiresApproval: {
      type: Boolean,
      default: false,
    },

    requiresReferral: {
      type: Boolean,
      default: false,
    },

    requiresPrepayment: {
      type: Boolean,
      default: false,
    },

    clinicalWorkflow: {
      type: String,
      trim: true,
      // Reference to workflow configuration (e.g., CONSULTATION_WORKFLOW, SURGERY_WORKFLOW)
    },

    aiProtocol: {
      type: String,
      trim: true,
      // Reference to AI decision support (e.g., TRIAGE, RISK_ASSESSMENT, PREPARATION_CHECK)
    },

    /* ==============================
       PREPARATION & FOLLOW-UP
    ============================== */
    preparationInstructions: {
      type: String,
      trim: true,
    },

    followUpRules: {
      type: Schema.Types.Mixed,
      default: {},
      // Example: { recommendedDays: 7, type: "FOLLOW_UP_CONSULTATION" }
    },

    /* ==============================
       BILLING & OPERATIONS
    ============================== */
    billingCode: {
      type: String,
      trim: true,
      index: true,
    },

    billingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    costCenter: {
      type: String,
      trim: true,
    },

    /* ==============================
       AVAILABILITY CONSTRAINTS
    ============================== */
    maxAppointmentsPerDay: {
      type: Number,
      default: 0,
      min: 0,
      // 0 = unlimited
    },

    minBookingHoursAdvance: {
      type: Number,
      default: 0,
      min: 0,
      // Hours before appointment can be booked
    },

    maxBookingHoursAdvance: {
      type: Number,
      default: 0,
      min: 0,
      // Hours before appointment can be booked (0 = no limit)
    },

    allowedDaysOfWeek: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
      // 0 = Sunday, 6 = Saturday
      validate: {
        validator: (values) =>
          Array.isArray(values) && values.every((v) => Number.isInteger(v) && v >= 0 && v <= 6),
        message: "allowedDaysOfWeek must be an array of integers between 0 and 6",
      },
    },

    /* ==============================
       STATUS & GOVERNANCE
    ============================== */
    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
      // If set, only available at this hospital. If null, available globally.
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    /* ==============================
       CUSTOM METADATA
    ============================== */
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/* ======================================================
   INDEXES
====================================================== */

// Global appointment type lookup
appointmentTypeSchema.index({ name: 1, active: 1 }, { name: "name_active_idx" });

// Hospital-specific lookup
appointmentTypeSchema.index(
  { hospital: 1, active: 1 },
  { name: "hospital_active_idx" }
);

// Billing tracking
appointmentTypeSchema.index({ billingCode: 1 }, { name: "billing_code_idx" });

export default mongoose.models.AppointmentType ||
  model("AppointmentType", appointmentTypeSchema);
