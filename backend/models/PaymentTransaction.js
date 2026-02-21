import mongoose from "mongoose";

const PaymentTransactionSchema = new mongoose.Schema({
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

PaymentTransactionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", PaymentTransactionSchema);
