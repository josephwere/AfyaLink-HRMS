import mongoose from "mongoose";
import { generatePrescriptionId } from "../services/idGenerator.js";

const PrescriptionSchema = new mongoose.Schema(
  {
    encounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Encounter",
      index: true,
      default: null,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
      default: null,
    },

    prescriptionId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      index: true,
      default: null,
    },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    medications: [
      {
        pharmacyItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PharmacyItem",
          default: null,
          index: true,
        },
        name: String,
        sku: String,
        unit: String,
        dosage: String,
        frequency: String,
        duration: String,
        requestedQuantity: { type: Number, default: 0 },
        availableQuantityAtPrescription: { type: Number, default: null },
        stockStatus: {
          type: String,
          enum: ["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "UNLINKED"],
          default: "UNLINKED",
        },
      },
    ],

    summary: {
      type: String,
      trim: true,
      default: "",
    },

    advice: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["CREATED", "DISPENSED", "CANCELLED"],
      default: "CREATED",
      index: true,
    },

    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dispensedAt: Date,
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
PrescriptionSchema.pre("save", async function (next) {
  if (!this.prescriptionId) {
    this.prescriptionId = await generatePrescriptionId();
  }

  if (!this.$locals?.viaWorkflow) {
    return next(new Error("Prescription must be created via workflow"));
  }
  next();
});

PrescriptionSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasPrescriptionId =
    update.prescriptionId !== undefined ||
    (update.$set && update.$set.prescriptionId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.prescriptionId !== undefined);

  if (!hasPrescriptionId) {
    const nextId = await generatePrescriptionId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        prescriptionId: nextId,
      },
    });
  }

  next();
});

export default mongoose.model("Prescription", PrescriptionSchema);
