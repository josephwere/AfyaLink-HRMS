import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const reportSchema = new Schema({
  title: String,
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  content: String,
  attachments: [String],
  metadata: Object,
}, { timestamps: true });

export default model('Report', reportSchema);
