import mongoose from 'mongoose';

const MappingSchema = new mongoose.Schema({
  connector: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector' },
  name: String,
  fields: { // example: { hl7: { 'PID-5.1': 'firstName' }, fhir: { 'name[0].given[0]':'firstName' } }
    type: Object,
    default: {}
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Mapping || mongoose.model('Mapping', MappingSchema);
