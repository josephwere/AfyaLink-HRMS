import mongoose from "mongoose";
const { Schema, model } = mongoose;

const dualApprovalSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital" },
    action: String,
    resourceId: Schema.Types.ObjectId,
    requestedBy: Schema.Types.ObjectId,
    approvedBy: Schema.Types.ObjectId,
    approvedAt: Date,
  },
  { timestamps: true }
);

export default model("DualApproval", dualApprovalSchema);
