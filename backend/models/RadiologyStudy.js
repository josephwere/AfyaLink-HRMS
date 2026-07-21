import mongoose from 'mongoose';
import { generateRadiologyRequestId } from '../services/idGenerator.js';

const RadiologyStudySchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Encounter',
      required: true,
      index: true,
    },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    studyType: { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    result: String,
    completedAt: Date,
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

RadiologyStudySchema.pre('save', async function (next) {
  if (!this.radiologyRequestId) {
    this.radiologyRequestId = await generateRadiologyRequestId();
  }

  if (!this.$locals?.viaWorkflow) {
    return next(new Error('RadiologyStudy must be created via workflow'));
  }
  next();
});

RadiologyStudySchema.pre('findOneAndUpdate', async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasRadiologyRequestId =
    update.radiologyRequestId !== undefined ||
    (update.$set && update.$set.radiologyRequestId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.radiologyRequestId !== undefined);

  if (!hasRadiologyRequestId) {
    const nextId = await generateRadiologyRequestId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        radiologyRequestId: nextId,
      },
    });
  }

  next();
});

export default mongoose.model('RadiologyStudy', RadiologyStudySchema);
