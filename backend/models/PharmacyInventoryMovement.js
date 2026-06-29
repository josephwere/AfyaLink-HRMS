import mongoose from "mongoose";

const Schema = mongoose.Schema;

const PharmacyInventoryMovementSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    movementType: {
      type: String,
      enum: ["RECEIPT", "DISPENSE", "ADJUSTMENT", "EXPIRY", "TRANSFER"],
      required: true,
      index: true,
    },
    batchNumber: { type: String, default: "", trim: true },
    expiryDate: { type: Date, default: null },
    quantity: { type: Number, default: 0 },
    previousQuantity: { type: Number, default: 0 },
    newQuantity: { type: Number, default: 0 },
    referenceType: { type: String, default: "MANUAL", trim: true },
    note: { type: String, default: "", trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

PharmacyInventoryMovementSchema.index({ hospital: 1, createdAt: -1 });

export default mongoose.models.PharmacyInventoryMovement || mongoose.model("PharmacyInventoryMovement", PharmacyInventoryMovementSchema);
