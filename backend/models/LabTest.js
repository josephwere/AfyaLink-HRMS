import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const labTestSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
  orderedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  testType: String,
  status: { type: String, enum:['Ordered','InProgress','Completed','Reviewed'], default: 'Ordered' },
  result: { type: Object },
  notes: String,
}, { timestamps: true });

export default model('LabTest', labTestSchema);
