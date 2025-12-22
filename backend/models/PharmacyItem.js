// backend/models/PharmacyItem.js
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  batchNumber: { type: String, required: false },
  expiryDate: { type: Date, required: false },
  quantity: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 }
}, { _id: false });

const PharmacyItemSchema = new Schema({
  name: { type: String, required: true, index: true },
  sku: { type: String, index: true, default: null },
  description: { type: String, default: '' },
  unit: { type: String, default: 'pcs' }, // e.g., pcs, box, vial
  totalQuantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 }, // low stock threshold
  batches: { type: [BatchSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
}, { timestamps: true });

export default mongoose.models.PharmacyItem || mongoose.model('PharmacyItem', PharmacyItemSchema);
