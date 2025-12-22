import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const notificationSchema = new Schema({
  title: String,
  body: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  read: { type: Boolean, default: false },
  meta: Object,
}, { timestamps: true });

export default model('Notification', notificationSchema);
