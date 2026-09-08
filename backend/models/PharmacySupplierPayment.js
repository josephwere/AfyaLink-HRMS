import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacySupplierPaymentSchema = new Schema({
  invoice: { type: Schema.Types.ObjectId, ref: "PharmacySupplierInvoice", required: true, index: true },
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", required: true, index: true },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  provider: { type: String, default: "", trim: true },
  reference: { type: String, required: true, unique: true, trim: true },
  status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING", index: true },
  paidAt: Date,
}, { timestamps: true });

export default mongoose.models.PharmacySupplierPayment || mongoose.model("PharmacySupplierPayment", pharmacySupplierPaymentSchema);
