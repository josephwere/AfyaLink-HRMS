import mongoose from "mongoose";

const EmergencySessionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    reason: { type: String },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    deactivatedAt: { type: Date },
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.EmergencySession || mongoose.model("EmergencySession", EmergencySessionSchema);
