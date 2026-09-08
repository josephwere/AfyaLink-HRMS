import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationReportSnapshotSchema = new Schema({
  consolidationRunId: { type: Schema.Types.ObjectId, ref: "ConsolidationRun", required: true, index: true },
  reportType: { type: String, enum: ["TRIAL_BALANCE", "PROFIT_LOSS", "BALANCE_SHEET", "CASH_FLOW"], required: true },
  content: { type: Object, required: true },
  version: { type: String, default: "1.0" },
  snapshotHash: { type: String, default: null },
  createdBy: { type: String, default: "system" },
  createdRole: { type: String, default: null },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: String, default: null },
  publishedRole: { type: String, default: null },
  publishedSignatureHash: { type: String, default: null },
  publishedComment: { type: String, default: null },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

export default model("ConsolidationReportSnapshot", consolidationReportSnapshotSchema);
