import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const patientSchema = new Schema({
  firstName: String,
  lastName: String,
  dob: Date,
  gender: String,
  nationalId: String,
  countryId: String, // Country-specific healthcare ID
  contact: String,
  address: String,
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  primaryDoctor: { type: Schema.Types.ObjectId, ref: 'User' },
  medicalRecords: [{ type: Schema.Types.ObjectId, ref: 'Report' }],
  insurance: { provider: String, policyNumber: String, metadata: Object },
  metadata: Object,
}, { timestamps: true });

export default model('Patient', patientSchema);
