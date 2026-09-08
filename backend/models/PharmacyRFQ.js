import mongoose from "mongoose";

const { Schema } = mongoose;

const rfqItemSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const pharmacyRfqSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
  items: { type: [rfqItemSchema], required: true },
  suppliers: [{ type: Schema.Types.ObjectId, ref: "PharmacySupplier" }],
  status: { type: String, enum: ["DRAFT", "SENT", "QUOTED", "AWARDED", "CANCELLED"], default: "DRAFT", index: true },
  responseDueAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

pharmacyRfqSchema.index({ hospital: 1, createdAt: -1 });

export default mongoose.models.PharmacyRFQ || mongoose.model("PharmacyRFQ", pharmacyRfqSchema);
