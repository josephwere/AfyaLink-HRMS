import mongoose from "mongoose";

const enforcementActionSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    country: { type: String, trim: true, uppercase: true, default: "" },
    authority: { type: String, trim: true, default: "MINISTRY_OF_HEALTH" },
    actionType: {
      type: String,
      enum: ["WARNING", "FINE", "SUSPEND_LICENSE", "REVOKE_LICENSE", "RESTRICT_PROCEDURE"],
      default: "WARNING",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED", "APPEALED"],
      default: "OPEN",
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    dueAt: Date,
    amount: { type: Number, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "KES" },
    notes: { type: String, trim: true, default: "" },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: Date,
    relatedInspection: { type: mongoose.Schema.Types.ObjectId, ref: "HospitalInspection", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

enforcementActionSchema.index({ hospital: 1, status: 1, issuedAt: -1 });
enforcementActionSchema.index({ country: 1, status: 1 });

export default mongoose.model("EnforcementAction", enforcementActionSchema);
