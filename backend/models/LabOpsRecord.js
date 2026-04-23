import mongoose from "mongoose";

const { Schema, model } = mongoose;

const labOpsRecordSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: [
        "SAMPLE_TRACKING",
        "EQUIPMENT_LOG",
        "QUALITY_CONTROL",
        "SAFETY_CHECK",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    status: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "OPEN",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    observedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

labOpsRecordSchema.index({ hospital: 1, kind: 1, observedAt: -1, createdAt: -1 });

export default mongoose.models.LabOpsRecord || model("LabOpsRecord", labOpsRecordSchema);
