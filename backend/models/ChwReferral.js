import mongoose from "mongoose";
import { generateReferralId } from "../services/idGenerator.js";

const { Schema, model } = mongoose;

const chwReferralSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, default: "", trim: true },
    summary: { type: String, required: true, trim: true },
    urgency: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "EMERGENCY"], default: "MEDIUM" },
    receivingHospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "ATTENDED", "CLOSED"], default: "PENDING", index: true },
    outcome: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

chwReferralSchema.index({ hospital: 1, status: 1, createdAt: -1 });

chwReferralSchema.pre("save", async function (next) {
  if (!this.referralId) {
    this.referralId = await generateReferralId();
  }
  next();
});

chwReferralSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasReferralId =
    update.referralId !== undefined ||
    (update.$set && update.$set.referralId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.referralId !== undefined);

  if (!hasReferralId) {
    const nextId = await generateReferralId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        referralId: nextId,
      },
    });
  }

  next();
});

export default mongoose.models.ChwReferral || model("ChwReferral", chwReferralSchema);

