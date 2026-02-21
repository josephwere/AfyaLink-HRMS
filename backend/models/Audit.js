import mongoose from 'mongoose';

const AuditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  target: String,
  details: { type: Object, default: {} },
  ip: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Audit || mongoose.model('Audit', AuditSchema);
