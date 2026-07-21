import mongoose from "mongoose";
import { generateClaimId } from "../services/idGenerator.js";

const { Schema } = mongoose;

const procedureSchema = new Schema(
  {
    code: { type: String, trim: true, index: true },
    name: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    quantity: { type: Number, default: 1 },
    amount: { type: Number, default: 0 },
    performedAt: Date,
  },
  { _id: false }
);

const claimSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    encounter: { type: Schema.Types.ObjectId, ref: "Encounter" },
    claimId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

    provider: {
      code: { type: String, trim: true, default: "" }, // SHA, NHIF, etc
      name: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
    },
    country: { type: String, trim: true, default: "" },
    currency: { type: String, trim: true, default: "KES" },
    totalAmount: { type: Number, default: 0 },

    servicePeriod: {
      start: Date,
      end: Date,
    },

    procedures: { type: [procedureSchema], default: [] },

    status: {
      type: String,
      enum: ["SUBMITTED", "REVIEW_REQUIRED", "APPROVED", "REJECTED", "PAID", "VOID"],
      default: "SUBMITTED",
      index: true,
    },

    riskScore: { type: Number, default: 0, index: true },
    riskFlags: { type: [String], default: [] },
    riskSignals: {
      type: [
        {
          code: String,
          severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
          message: String,
        },
      ],
      default: [],
    },

    duplicateOf: { type: Schema.Types.ObjectId, ref: "Claim", default: null },
    duplicateGroup: { type: String, trim: true, default: "" },

    submissionChannel: { type: String, enum: ["API", "UI", "SYSTEM"], default: "API" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },

    signature: {
      algorithm: { type: String, default: "HMAC-SHA256" },
      value: { type: String, default: "" },
      keyId: { type: String, default: "" },
      signedAt: Date,
    },

    patientSnapshot: {
      nationalId: { type: String, trim: true, default: "" },
      countryId: { type: String, trim: true, default: "" },
      dob: Date,
      gender: { type: String, trim: true, default: "" },
      registryMatch: { type: Boolean, default: null },
      identityStatus: { type: String, trim: true, default: "" },
    },

    hospitalSnapshot: {
      name: { type: String, trim: true, default: "" },
      registrationNumber: { type: String, trim: true, default: "" },
      verificationStatus: { type: String, trim: true, default: "" },
    },

    decision: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: Date,
      notes: { type: String, trim: true, default: "" },
    },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

claimSchema.index({ hospital: 1, createdAt: -1 });
claimSchema.index({ patient: 1, createdAt: -1 });
claimSchema.index({ "provider.code": 1, status: 1, createdAt: -1 });
claimSchema.index({ duplicateGroup: 1 });

claimSchema.pre("save", async function (next) {
  if (!this.claimId) {
    this.claimId = await generateClaimId();
  }
  next();
});

claimSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasClaimId =
    update.claimId !== undefined ||
    (update.$set && update.$set.claimId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.claimId !== undefined);

  if (!hasClaimId) {
    const nextId = await generateClaimId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        claimId: nextId,
      },
    });
  }

  next();
});

export default mongoose.models.Claim || mongoose.model("Claim", claimSchema);

