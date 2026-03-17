import mongoose from "mongoose";

const FraudAlertSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: "Claim", index: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", index: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM", index: true },
    signals: { type: [String], default: [] },
    status: { type: String, enum: ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"], default: "OPEN", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedRole: { type: String, trim: true, default: "" },
    assignedAt: Date,
    notes: { type: String, trim: true, default: "" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: Date,
    feedback: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          notes: { type: String, trim: true, default: "" },
          actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

FraudAlertSchema.index({ createdAt: -1 });
FraudAlertSchema.index({ hospital: 1, status: 1, createdAt: -1 });

export default mongoose.model("FraudAlert", FraudAlertSchema);
