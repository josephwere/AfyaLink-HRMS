import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const financialSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  invoiceNumber: { type: String, required: true, unique: true },
  items: [{ description: String, amount: Number }],
  total: Number,
  status: { type: String, enum:['Pending','Paid','Cancelled'], default: 'Pending' },
  insuranceClaim: { provider: String, claimId: String, status: String },
  metadata: Object,
}, { timestamps: true });

export default model('Financial', financialSchema);
