import mongoose from "mongoose";
const { Schema, model } = mongoose;

const journalEntrySchema = new Schema({
  entryNumber: { type: String, required: true, unique: true, index: true },
  entryType: { type: String, enum: ["INVOICE_ISSUED", "PAYMENT_RECEIVED", "REFUND", "ADJUSTMENT"], required: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: "Financial", default: null },
  paymentReceiptId: { type: Schema.Types.ObjectId, ref: "PaymentReceipt", default: null },
  description: { type: String, required: true },
  currency: { type: String, default: "KES" },
  totalDebit: { type: Number, required: true, default: 0 },
  totalCredit: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ["POSTED", "VOIDED"], default: "POSTED" },
  postedAt: { type: Date, default: Date.now },
  isImmutable: { type: Boolean, default: true },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

journalEntrySchema.pre("save", function (next) {
  if (this.totalDebit !== this.totalCredit) {
    return next(new Error("Journal entry must balance: total debit must equal total credit"));
  }
  next();
});

export default model("JournalEntry", journalEntrySchema);
