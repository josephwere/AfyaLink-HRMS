import mongoose from "mongoose";

const { Schema } = mongoose;

const purchaseOrderLineSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true, min: 0 },
}, { _id: false });

const pharmacyPurchaseOrderSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  items: { type: [purchaseOrderLineSchema], required: true },
  status: { type: String, enum: ["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "SHIPPED", "RECEIVED", "CANCELLED"], default: "SUBMITTED", index: true },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING", index: true },
  paymentReference: { type: String, default: "" },
  expectedDeliveryAt: Date,
  totalAmount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacyPurchaseOrderSchema.index({ hospital: 1, createdAt: -1 });
pharmacyPurchaseOrderSchema.index({ supplier: 1, createdAt: -1 });

export default mongoose.models.PharmacyPurchaseOrder || mongoose.model("PharmacyPurchaseOrder", pharmacyPurchaseOrderSchema);
