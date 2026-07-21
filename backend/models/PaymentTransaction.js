import mongoose from "mongoose";
import { generatePaymentId } from "../services/idGenerator.js";

const PaymentTransactionSchema = new mongoose.Schema({
  paymentId: { type: String, unique: true, sparse: true, immutable: true, index: true },
  merchantRequestID: { type: String, index: true },
  checkoutRequestID: { type: String, index: true },
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  resultCode: { type: Number, default: null },
  resultDesc: { type: String, default: null },
  callbackRaw: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

PaymentTransactionSchema.pre("save", async function (next) {
  if (!this.paymentId) {
    this.paymentId = await generatePaymentId();
  }
  this.updatedAt = new Date();
  next();
});

PaymentTransactionSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasPaymentId =
    update.paymentId !== undefined ||
    (update.$set && update.$set.paymentId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.paymentId !== undefined);

  if (!hasPaymentId) {
    const nextId = await generatePaymentId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        paymentId: nextId,
      },
    });
  }

  next();
});

export default mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", PaymentTransactionSchema);
