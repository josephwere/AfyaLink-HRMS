import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
  provider: String,
  reference: { type: String, index: true },
  amount: Number,
  currency: { type: String, default: 'KES' },
  status: { type: String, default: 'pending' },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

TransactionSchema.index({ hospital: 1, createdAt: -1 });
TransactionSchema.index({ hospital: 1, status: 1, createdAt: -1 });
TransactionSchema.index({ reference: 1, hospital: 1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
