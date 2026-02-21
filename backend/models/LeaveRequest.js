import mongoose from "mongoose";

const { Schema, model } = mongoose;

const leaveRequestSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", index: true },
    type: { type: String, default: "Annual" },
    reason: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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

leaveRequestSchema.index({ hospital: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ hospital: 1, requester: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ hospital: 1, startDate: -1, endDate: -1 });
leaveRequestSchema.index({ hospital: 1, status: 1, escalationLevel: 1, createdAt: -1 });

export default model("LeaveRequest", leaveRequestSchema);
