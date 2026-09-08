import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationApprovalSchema = new Schema({
  consolidationRunId: { type: Schema.Types.ObjectId, ref: "ConsolidationRun", required: true, index: true },
  approverId: { type: String, required: true, index: true },
  approverRole: { type: String, required: true },
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  comment: { type: String, default: "" },
  signatureHash: { type: String, default: null },
  approvedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default model("ConsolidationApproval", consolidationApprovalSchema);
