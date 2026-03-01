import mongoose from "mongoose";

const { Schema, model } = mongoose;

const customizationRequestSchema = new Schema(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },
    scope: {
      type: String,
      enum: ["HOSPITAL", "COUNTRY", "REGION", "GLOBAL"],
      default: "HOSPITAL",
      index: true,
    },
    country: { type: String, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true },
    requirements: { type: String, required: true, trim: true },
    requestedModules: { type: [String], default: [] },
    exclusiveDeployment: { type: Boolean, default: false },
    desiredGoLiveDate: Date,
    status: {
      type: String,
      enum: ["OPEN", "UNDER_REVIEW", "APPROVED", "IN_PROGRESS", "DELIVERED", "REJECTED"],
      default: "OPEN",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

customizationRequestSchema.index({ hospital: 1, createdAt: -1 });
customizationRequestSchema.index({ scope: 1, country: 1, createdAt: -1 });

export default model("CustomizationRequest", customizationRequestSchema);

