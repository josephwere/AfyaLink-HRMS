import mongoose from "mongoose";
import { generateLaboratoryRequestId } from "../services/idGenerator.js";

const LabOrderSchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      required: true,
      index: true,
    },

    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    laboratoryRequestId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

    testName: { type: String, required: true },

    status: {
      type: String,
      enum: ["Pending", "Completed", "Cancelled"],
      default: "Pending",
      index: true,
    },

    result: String,
    completedAt: Date,
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
LabOrderSchema.pre("save", async function (next) {
  if (!this.laboratoryRequestId) {
    this.laboratoryRequestId = await generateLaboratoryRequestId();
  }

  if (!this.$locals?.viaWorkflow && this.isNew) {
    return next(new Error("LabOrder must be created via workflow"));
  }
  next();
});

LabOrderSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasLaboratoryRequestId =
    update.laboratoryRequestId !== undefined ||
    (update.$set && update.$set.laboratoryRequestId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.laboratoryRequestId !== undefined);

  if (!hasLaboratoryRequestId) {
    const nextId = await generateLaboratoryRequestId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        laboratoryRequestId: nextId,
      },
    });
  }

  next();
});

export default mongoose.model("LabOrder", LabOrderSchema);
