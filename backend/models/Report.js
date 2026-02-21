import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const reportSchema = new Schema({
  title: String,
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
  content: String,
  attachments: [String],
  metadata: Object,
}, { timestamps: true });

reportSchema.index({ hospital: 1, createdAt: -1 });
reportSchema.index({ hospital: 1, createdBy: 1, createdAt: -1 });
reportSchema.index({ hospital: 1, patient: 1, createdAt: -1 });

export default model('Report', reportSchema);
