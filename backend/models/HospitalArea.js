import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   HOSPITAL AREA — ZONE CONTROL
====================================================== */
const hospitalAreaSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    zoneType: {
      type: String,
      enum: [
        "PUBLIC",
        "SEMI_RESTRICTED",
        "RESTRICTED",
        "CRITICAL",
        "ISOLATION",
      ],
      required: true,
      index: true,
    },

    requiresEscort: {
      type: Boolean,
      default: false,
    },

    allowedRoles: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.HospitalArea ||
  model("HospitalArea", hospitalAreaSchema);
