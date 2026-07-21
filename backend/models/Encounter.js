import mongoose from "mongoose";
import { WORKFLOW } from "../constants/workflowStates.js";
import { generateEncounterId } from "../services/idGenerator.js";

const EncounterSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    encounterId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },
    wardRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      default: null,
      index: true,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },

    state: {
      type: String,
      enum: Object.values(WORKFLOW),
      default: WORKFLOW.CREATED,
      index: true,
    },

    consultationNotes: String,
    diagnosis: String,

    labOrders: [
      { type: mongoose.Schema.Types.ObjectId, ref: "LabOrder" },
    ],
    prescriptions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Prescription" },
    ],

    bill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },

    closedAt: Date,
  },
  { timestamps: true }
);

/* =========================================================
   🔐 HARD WORKFLOW ENFORCEMENT (NON-BYPASSABLE)
========================================================= */

EncounterSchema.pre("save", async function (next) {
  if (!this.encounterId) {
    this.encounterId = await generateEncounterId();
  }

  /**
   * Any Encounter mutation MUST originate from workflow engine.
   * workflowEffects MUST set:
   *   encounter.$locals.viaWorkflow = true
   */
  if (!this.$locals?.viaWorkflow) {
    return next(
      new Error(
        "Direct Encounter mutation forbidden. Use workflowService."
      )
    );
  }

  next();
});

EncounterSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasEncounterId =
    update.encounterId !== undefined ||
    (update.$set && update.$set.encounterId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.encounterId !== undefined);

  if (!hasEncounterId) {
    const nextId = await generateEncounterId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        encounterId: nextId,
      },
    });
  }

  next();
});

/**
 * Block findOneAndUpdate / updateOne / updateMany
 */
EncounterSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function () {
    throw new Error(
      "Direct Encounter updates forbidden. Use workflowService."
    );
  }
);

export default mongoose.model("Encounter", EncounterSchema);
