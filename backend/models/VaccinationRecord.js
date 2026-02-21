import mongoose from "mongoose";

const { Schema, model } = mongoose;

const vaccinationRecordSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", default: null, index: true },
    memberName: { type: String, required: true, trim: true },
    vaccine: { type: String, required: true, trim: true },
    dose: { type: String, default: "", trim: true },
    batchNumber: { type: String, default: "", trim: true },
    expiryDate: { type: Date, default: null },
    administeredAt: { type: Date, default: Date.now, index: true },
    adverseEvent: { type: String, default: "", trim: true },
    coldChainStatus: { type: String, default: "OK", trim: true },
  },
  { timestamps: true, versionKey: false }
);

vaccinationRecordSchema.index({ hospital: 1, administeredAt: -1 });

export default mongoose.models.VaccinationRecord ||
  model("VaccinationRecord", vaccinationRecordSchema);

