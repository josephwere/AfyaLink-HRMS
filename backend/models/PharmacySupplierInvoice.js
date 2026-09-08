import mongoose from "mongoose";

const { Schema } = mongoose;

const pharmacySupplierInvoiceSchema = new Schema({
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", required: true, index: true },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  invoiceNumber: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["ISSUED", "PARTIALLY_PAID", "PAID", "VOIDED"], default: "ISSUED", index: true },
  dueAt: Date,
}, { timestamps: true });

pharmacySupplierInvoiceSchema.index({ supplier: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.models.PharmacySupplierInvoice || mongoose.model("PharmacySupplierInvoice", pharmacySupplierInvoiceSchema);
