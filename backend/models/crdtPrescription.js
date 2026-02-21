import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  docId: { type: String, index:true, required:true },
  docBin: Buffer,
  updatedAt: { type: Date, default: Date.now }
});
export default mongoose.models.CrdtPrescription || mongoose.model('CrdtPrescription', schema);
