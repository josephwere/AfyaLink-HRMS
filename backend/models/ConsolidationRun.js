import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationRunSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, required: true, index: true },
  period: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PUBLISHED", "RUNNING", "COMPLETED", "FAILED"],
    default: "DRAFT",
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  exchangeRateSet: { type: String, default: "default" },
  rulesVersion: { type: String, default: "1.0" },
  createdBy: { type: String, default: "system" },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

export default model("ConsolidationRun", consolidationRunSchema);
