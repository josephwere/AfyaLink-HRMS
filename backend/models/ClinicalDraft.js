import mongoose from "mongoose";

const { Schema, model } = mongoose;

const clinicalDraftSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    draftType: {
      type: String,
      enum: ["OPD_CONSULTATION", "DOCTOR_NOTE"],
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

clinicalDraftSchema.index(
  { hospital: 1, patient: 1, author: 1, draftType: 1 },
  { unique: true, name: "clinical_draft_unique_scope" }
);

export default mongoose.models.ClinicalDraft || model("ClinicalDraft", clinicalDraftSchema);
