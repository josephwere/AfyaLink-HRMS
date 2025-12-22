import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  provider: String,
  reference: { type: String, index: true },
  amount: Number,
  currency: { type: String, default: 'KES' },
  status: { type: String, default: 'pending' },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
