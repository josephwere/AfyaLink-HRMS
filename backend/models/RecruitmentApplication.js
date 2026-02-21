import mongoose from "mongoose";

const { Schema, model } = mongoose;

const recruitmentApplicationSchema = new Schema(
  {
    ad: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentAd",
      required: true,
      index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    applicantRole: {
      type: String,
      index: true,
    },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    coverLetter: { type: String, trim: true },
    resumeUrl: { type: String, trim: true },
    experienceSummary: { type: String, trim: true },
    status: {
      type: String,
      enum: ["NEW", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "HIRED"],
      default: "NEW",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

recruitmentApplicationSchema.index({ ad: 1, applicant: 1 }, { unique: true });
recruitmentApplicationSchema.index({ hospital: 1, status: 1, createdAt: -1 });
recruitmentApplicationSchema.index({ applicant: 1, createdAt: -1 });

export default model("RecruitmentApplication", recruitmentApplicationSchema);
