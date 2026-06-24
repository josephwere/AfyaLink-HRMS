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
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  name: { type: String, required: true, index: true },
  sku: { type: String, index: true, default: null },
  description: { type: String, default: '' },
  category: { type: String, default: 'medicine', index: true },
  form: { type: String, default: '' },
  strength: { type: String, default: '' },
  unit: { type: String, default: 'pcs' }, // e.g., pcs, box, vial
  totalQuantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 }, // low stock threshold
  active: { type: Boolean, default: true, index: true },
  batches: { type: [BatchSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
}, { timestamps: true });

PharmacyItemSchema.index({ hospital: 1, name: 1 });
PharmacyItemSchema.index({ hospital: 1, active: 1, totalQuantity: -1, name: 1 });

export default mongoose.models.PharmacyItem || mongoose.model('PharmacyItem', PharmacyItemSchema);
