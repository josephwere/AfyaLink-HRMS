import mongoose from "mongoose";
const { Schema, model } = mongoose;

const journalLineSchema = new Schema({
  journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", required: true, index: true },
  accountCode: { type: String, required: true, index: true },
  accountName: { type: String, required: true },
  direction: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, default: "" },
}, { timestamps: true });

export default model("JournalLine", journalLineSchema);
