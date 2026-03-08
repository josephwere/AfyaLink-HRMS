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
    workMode: {
      type: String,
      enum: ["ONSITE", "HYBRID", "REMOTE", "FLEXIBLE"],
      default: "ONSITE",
      index: true,
    },
    location: { type: String, trim: true },
    salaryRange: { type: String, trim: true },
    hiringCount: { type: Number, default: 1, min: 1 },
    seniorityLevel: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: [{ type: String, trim: true }],
    benefits: [{ type: String, trim: true }],
    highlights: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, index: true }],
    campaignSummary: { type: String, trim: true },
    bannerHeadline: { type: String, trim: true },
    bannerSubheadline: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    applyUrl: { type: String, trim: true },
    careersPageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    applicationMode: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL", "HYBRID"],
      default: "INTERNAL",
      index: true,
    },
    visibility: {
      type: String,
      enum: ["PUBLIC", "STAFF_ONLY", "PRIVATE_LINK"],
      default: "PUBLIC",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    priority: { type: Number, default: 50, min: 1, max: 100 },
    campaignStartAt: { type: Date, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },
    expiresAt: { type: Date, index: true },
    media: {
      coverImage: {
        originalName: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        sizeBytes: { type: Number, default: 0 },
        storagePath: { type: String, trim: true, default: "" },
        publicUrl: { type: String, trim: true, default: "" },
        uploadedAt: Date,
      },
      gallery: [
        {
          originalName: { type: String, trim: true, default: "" },
          mimeType: { type: String, trim: true, default: "" },
          sizeBytes: { type: Number, default: 0 },
          storagePath: { type: String, trim: true, default: "" },
          publicUrl: { type: String, trim: true, default: "" },
          uploadedAt: Date,
        },
      ],
      bannerLink: { type: String, trim: true, default: "" },
      brochureUrl: { type: String, trim: true, default: "" },
    },
    analytics: {
      viewCount: { type: Number, default: 0 },
      applyIntentCount: { type: Number, default: 0 },
      internalApplyCount: { type: Number, default: 0 },
      externalClickCount: { type: Number, default: 0 },
      careersPageClickCount: { type: Number, default: 0 },
      brochureClickCount: { type: Number, default: 0 },
      videoClickCount: { type: Number, default: 0 },
      bannerClickCount: { type: Number, default: 0 },
      sourceAttribution: { type: Schema.Types.Mixed, default: {} },
      eventSourceAttribution: { type: Schema.Types.Mixed, default: {} },
      lastInteractionAt: Date,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

recruitmentAdSchema.index({ hospital: 1, status: 1, createdAt: -1 });
recruitmentAdSchema.index({ status: 1, createdAt: -1 });
recruitmentAdSchema.index({ hospital: 1, featured: 1, priority: -1, createdAt: -1 });
recruitmentAdSchema.index({ title: "text", description: "text", department: "text", location: "text" });

export default model("RecruitmentAd", recruitmentAdSchema);
