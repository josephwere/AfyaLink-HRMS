import mongoose from "mongoose";

const { Schema, model } = mongoose;

const shiftRequestSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", index: true },
    shiftType: { type: String, default: "Day" },
    date: { type: Date, required: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    approvalStage: {
      type: String,
      enum: ["L1_PENDING", "L2_PENDING", "APPROVED_FINAL", "REJECTED_FINAL"],
      default: "L1_PENDING",
      index: true,
    },
    stageOneApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    stageOneApprovedAt: Date,
    stageTwoApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    stageTwoApprovedAt: Date,
    fallbackRole: String,
    escalatedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectionReason: String,
    slaDueAt: { type: Date, index: true },
    slaBreachedAt: { type: Date, index: true },
    escalationLevel: { type: Number, default: 0, index: true },
    lastEscalatedAt: Date,
  },
  { timestamps: true }
);

shiftRequestSchema.index({ hospital: 1, status: 1, createdAt: -1 });
shiftRequestSchema.index({ hospital: 1, requester: 1, status: 1, createdAt: -1 });
shiftRequestSchema.index({ hospital: 1, date: -1, shiftType: 1 });
shiftRequestSchema.index({ hospital: 1, status: 1, escalationLevel: 1, createdAt: -1 });

export default model("ShiftRequest", shiftRequestSchema);
