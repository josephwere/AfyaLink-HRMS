import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const transferSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  fromHospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  toHospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum:['Pending','Approved','Rejected','Completed'], default: 'Pending' },
  reasons: String,
  audit: [Object],
  metadata: Object,
}, { timestamps: true });

transferSchema.index({ fromHospital: 1, createdAt: -1 });
transferSchema.index({ toHospital: 1, createdAt: -1 });
transferSchema.index({ patient: 1, createdAt: -1 });
transferSchema.index({ status: 1, createdAt: -1 });
transferSchema.index({ fromHospital: 1, status: 1, createdAt: -1 });
transferSchema.index({ toHospital: 1, status: 1, createdAt: -1 });
transferSchema.index({ requestedBy: 1, createdAt: -1 });
transferSchema.index({ approvedBy: 1, createdAt: -1 });

export default model('Transfer', transferSchema);
