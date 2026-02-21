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
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, category: 1, createdAt: -1 });
notificationSchema.index({ hospital: 1, createdAt: -1 });
notificationSchema.index({ hospital: 1, category: 1, read: 1, createdAt: -1 });

export default model('Notification', notificationSchema);
