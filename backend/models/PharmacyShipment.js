import mongoose from "mongoose";

const { Schema } = mongoose;

const shipmentItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  quantity: { type: Number, required: true, min: 0 },
  batchNumber: { type: String, default: "" },
  expiryDate: Date,
}, { _id: false });

const pharmacyShipmentSchema = new Schema({
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", required: true, unique: true },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  status: { type: String, enum: ["ACCEPTED", "PROCESSING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "RECEIVED"], default: "ACCEPTED", index: true },
  trackingNumber: { type: String, default: "", trim: true },
  deliveryProofUrl: { type: String, default: "" },
  items: { type: [shipmentItemSchema], default: [] },
  dispatchedAt: Date,
  deliveredAt: Date,
}, { timestamps: true });

export default mongoose.models.PharmacyShipment || mongoose.model("PharmacyShipment", pharmacyShipmentSchema);
