import mongoose from "mongoose";
const { Schema, model } = mongoose;

const financialDimensionSchema = new Schema({
  journalLineId: { type: Schema.Types.ObjectId, ref: "JournalLine", required: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true },
  branchId: { type: Schema.Types.ObjectId, default: null, index: true },
  department: { type: String, default: null, index: true },
  costCenter: { type: String, default: null, index: true },
  doctorId: { type: Schema.Types.ObjectId, default: null, index: true },
  insuranceProvider: { type: String, default: null, index: true },
  project: { type: String, default: null, index: true },
  currency: { type: String, default: "KES", index: true },
  exchangeRate: { type: Number, default: 1 },
}, { timestamps: true });

export default model("FinancialDimension", financialDimensionSchema);
