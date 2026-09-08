import mongoose from "mongoose";

const { Schema } = mongoose;

const supplierProductBatchSchema = new Schema({
  batchNumber: { type: String, default: "" },
  expiryDate: Date,
  quantity: { type: Number, default: 0, min: 0 },
}, { _id: false });

const pharmacySupplierProductSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "PharmacySupplier", required: true, index: true },
  name: { type: String, required: true, trim: true },
  genericName: { type: String, default: "" },
  sku: { type: String, default: "", trim: true },
  unit: { type: String, default: "pcs" },
  unitPrice: { type: Number, default: 0, min: 0 },
  minimumOrderQuantity: { type: Number, default: 1, min: 1 },
  deliveryAreas: { type: [String], default: [] },
  batches: { type: [supplierProductBatchSchema], default: [] },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

pharmacySupplierProductSchema.index({ supplier: 1, sku: 1 });

export default mongoose.models.PharmacySupplierProduct || mongoose.model("PharmacySupplierProduct", pharmacySupplierProductSchema);
