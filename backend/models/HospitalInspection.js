import mongoose from "mongoose";

const findingSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    details: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const correctiveActionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    dueAt: Date,
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED"], default: "OPEN" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const hospitalInspectionSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    country: { type: String, trim: true, uppercase: true, default: "" },
    authority: { type: String, trim: true, default: "MINISTRY_OF_HEALTH" },
    type: { type: String, enum: ["ROUTINE", "ADHOC"], default: "ROUTINE", index: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"],
      default: "SCHEDULED",
      index: true,
    },
    scheduledAt: Date,
    performedAt: Date,
    findings: { type: [findingSchema], default: [] },
    correctiveActions: { type: [correctiveActionSchema], default: [] },
    complianceScore: { type: Number, default: 0 },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

hospitalInspectionSchema.index({ country: 1, status: 1 });
hospitalInspectionSchema.index({ hospital: 1, scheduledAt: -1 });

export default mongoose.model("HospitalInspection", hospitalInspectionSchema);
