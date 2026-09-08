import mongoose from "mongoose";

const { Schema } = mongoose;

const quotationItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
}, { _id: false });

const pharmacyQuotationSchema = new Schema({
  rfq: { type: Schema.Types.ObjectId, ref: "PharmacyRFQ", required: true, index: true },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  items: { type: [quotationItemSchema], required: true },
  leadTimeDays: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  paymentTerms: { type: String, default: "" },
  expectedDeliveryAt: Date,
  reliabilityScore: { type: Number, default: 0, min: 0, max: 100 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ["SUBMITTED", "SHORTLISTED", "ACCEPTED", "REJECTED"], default: "SUBMITTED", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacyQuotationSchema.index({ rfq: 1, supplier: 1 }, { unique: true });

export default mongoose.models.PharmacyQuotation || mongoose.model("PharmacyQuotation", pharmacyQuotationSchema);
