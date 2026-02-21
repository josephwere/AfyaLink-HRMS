import mongoose from "mongoose";

const { Schema, model } = mongoose;

const recruitmentAdSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    department: { type: String, trim: true },
    employmentType: { type: String, trim: true },
    location: { type: String, trim: true },
    salaryRange: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: [{ type: String, trim: true }],
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    applyUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },
    expiresAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

recruitmentAdSchema.index({ hospital: 1, status: 1, createdAt: -1 });
recruitmentAdSchema.index({ status: 1, createdAt: -1 });
recruitmentAdSchema.index({ title: "text", description: "text", department: "text", location: "text" });

export default model("RecruitmentAd", recruitmentAdSchema);
