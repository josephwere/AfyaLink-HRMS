import mongoose from "mongoose";

const Schema = mongoose.Schema;

const PharmacyReservationSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: "PharmacyItem", required: true, index: true },
    prescriptionId: { type: Schema.Types.ObjectId, ref: "Prescription", default: null, index: true },
    batchNumber: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "FULFILLED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    reservedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fulfilledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

PharmacyReservationSchema.index({ hospital: 1, status: 1, createdAt: -1 });

export default mongoose.models.PharmacyReservation || mongoose.model("PharmacyReservation", PharmacyReservationSchema);
