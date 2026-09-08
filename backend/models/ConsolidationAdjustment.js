import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationAdjustmentSchema = new Schema({
  consolidationRunId: { type: Schema.Types.ObjectId, ref: "ConsolidationRun", required: true, index: true },
  accountCode: { type: String, required: true },
  amount: { type: Number, required: true },
  direction: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
  description: { type: String, default: "" },
  category: { type: String, enum: ["ACQUISITION", "GOODWILL", "DEFERRED_TAX", "IMPAIRMENT", "AUDIT", "OTHER"], default: "OTHER" },
}, { timestamps: true });

export default model("ConsolidationAdjustment", consolidationAdjustmentSchema);
