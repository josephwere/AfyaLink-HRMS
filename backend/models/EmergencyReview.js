import mongoose from "mongoose";

const EmergencyReviewSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "EmergencySession", required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], required: true },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.EmergencyReview || mongoose.model("EmergencyReview", EmergencyReviewSchema);
