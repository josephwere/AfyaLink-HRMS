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

export default model('Transfer', transferSchema);
