import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationEliminationSchema = new Schema({
  parentEntityId: { type: Schema.Types.ObjectId, ref: "ConsolidationEntity", required: true, index: true },
  sourceEntityId: { type: Schema.Types.ObjectId, ref: "ConsolidationEntity", required: true, index: true },
  targetEntityId: { type: Schema.Types.ObjectId, ref: "ConsolidationEntity", required: true, index: true },
  accountCode: { type: String, required: true },
  amount: { type: Number, required: true },
  direction: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
  description: { type: String, default: "" },
  status: { type: String, enum: ["PENDING", "APPLIED"], default: "PENDING" },
}, { timestamps: true });

export default model("ConsolidationElimination", consolidationEliminationSchema);
