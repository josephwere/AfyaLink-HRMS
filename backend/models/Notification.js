import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const notificationSchema = new Schema({
  title: String,
  body: String,
  category: { type: String, default: "SYSTEM", index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  read: { type: Boolean, default: false },
  meta: Object,
  deliveryStatus: { type: String, enum: ["PENDING", "DELIVERED", "FAILED", "ESCALATED"], default: "PENDING", index: true },
  deliveryAttempts: { type: Number, default: 0 },
  deliveredAt: { type: Date, default: null },
  lastDeliveryError: { type: String, default: "" },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, category: 1, createdAt: -1 });
notificationSchema.index({ hospital: 1, createdAt: -1 });
notificationSchema.index({ hospital: 1, category: 1, read: 1, createdAt: -1 });
notificationSchema.index({ "meta.idempotencyKey": 1 }, { unique: true, sparse: true });

export default model('Notification', notificationSchema);
