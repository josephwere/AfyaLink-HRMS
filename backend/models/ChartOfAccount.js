import mongoose from "mongoose";
const { Schema, model } = mongoose;

const chartOfAccountSchema = new Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], required: true },
  parentCode: { type: String, default: null },
  normalBalance: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
  status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  description: { type: String, default: "" },
}, { timestamps: true });

export default model("ChartOfAccount", chartOfAccountSchema);
