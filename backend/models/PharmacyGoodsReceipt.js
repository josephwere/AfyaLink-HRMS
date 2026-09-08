import mongoose from "mongoose";

const { Schema } = mongoose;

const goodsReceiptItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  expectedQuantity: { type: Number, required: true, min: 0 },
  receivedQuantity: { type: Number, required: true, min: 0 },
  damagedQuantity: { type: Number, default: 0, min: 0 },
  rejectedQuantity: { type: Number, default: 0, min: 0 },
  batchNumber: { type: String, default: "" },
  expiryDate: Date,
}, { _id: false });

const pharmacyGoodsReceiptSchema = new Schema({
  purchaseOrder: { type: Schema.Types.ObjectId, ref: "PharmacyPurchaseOrder", required: true, unique: true },
  shipment: { type: Schema.Types.ObjectId, ref: "PharmacyShipment", default: null },
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: { type: [goodsReceiptItemSchema], required: true },
  note: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.models.PharmacyGoodsReceipt || mongoose.model("PharmacyGoodsReceipt", pharmacyGoodsReceiptSchema);
