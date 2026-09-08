import mongoose from "mongoose";
const { Schema, model } = mongoose;

const accountingPeriodSchema = new Schema({
  periodKey: { type: String, required: true, unique: true, index: true },
  label: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ["OPEN", "SOFT_CLOSED", "CLOSED", "LOCKED"], default: "OPEN" },
  description: { type: String, default: "" },
}, { timestamps: true });

export default model("AccountingPeriod", accountingPeriodSchema);
