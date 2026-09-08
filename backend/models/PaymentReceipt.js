import mongoose from "mongoose";
const { Schema, model } = mongoose;

const paymentReceiptSchema = new Schema({
  paymentReference: { type: String, unique: true, sparse: true },
  provider: { type: String, default: "UNKNOWN" },
  providerTransactionId: { type: String, unique: true, sparse: true, index: true },
  idempotencyKey: { type: String, unique: true, sparse: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital" },
  invoiceId: { type: Schema.Types.ObjectId, ref: "Financial" },
  method: { type: String, default: "CASH" },
  reference: { type: String, default: "" },
  amount: { type: Number, required: true },
  currency: { type: String, default: "KES" },
  status: { type: String, default: "PROCESSED" },
  receivedAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

export default model("PaymentReceipt", paymentReceiptSchema);
