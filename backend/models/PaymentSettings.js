import mongoose from 'mongoose';

const PaymentSettingsSchema = new mongoose.Schema({
  stripe: { type: Object, default: {} },
  mpesa: { type: Object, default: {} },
  flutterwave: { type: Object, default: {} },
  mode: { type: String, enum: ['test','live'], default: 'test' },
  // per-document salt for encryption key derivation
  salt: { type: String, default: null },
  // 2FA secret (TOTP) stored encrypted or plain depending on policy; here stored as string
  twoFA: { secret: { type: String }, enabled: { type: Boolean, default: false } },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.PaymentSettings || mongoose.model('PaymentSettings', PaymentSettingsSchema);
