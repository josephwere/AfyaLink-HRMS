import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   ACCESS VIOLATION — SECURITY EVENTS
====================================================== */
const accessViolationSchema = new Schema(
  {
    accessEntry: {
      type: Schema.Types.ObjectId,
      ref: "AccessEntry",
      required: true,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    type: {
      type: String,
      enum: [
        "OVERSTAY",
        "WRONG_AREA",
        "EXPIRED_CODE",
        "BLACKLISTED_PERSON",
        "DUPLICATE_USE",
        "MANUAL_OVERRIDE",
      ],
      required: true,
      index: true,
    },

    description: String,

    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },

    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.models.AccessViolation ||
  model("AccessViolation", accessViolationSchema);
