import mongoose from "mongoose";

const { Schema, model } = mongoose;

const complianceLegalHoldSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    region: { type: String, default: "DEFAULT", trim: true, uppercase: true, index: true },
    scopeType: {
      type: String,
      enum: ["SYSTEM", "HOSPITAL", "PATIENT", "CLAIM", "EXPORT", "LEGAL_REQUEST"],
      default: "SYSTEM",
      index: true,
    },
    scopeRef: { type: String, default: "", trim: true },
    legalBasis: { type: String, default: "", trim: true },
    retentionOverrideDays: { type: Number, default: null },
    status: {
      type: String,
      enum: ["ACTIVE", "RELEASED"],
      default: "ACTIVE",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releasedAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

complianceLegalHoldSchema.index({ status: 1, createdAt: -1 });
complianceLegalHoldSchema.index({ region: 1, status: 1, createdAt: -1 });
complianceLegalHoldSchema.index({ scopeType: 1, scopeRef: 1, status: 1 });

export default mongoose.models.ComplianceLegalHold || model("ComplianceLegalHold", complianceLegalHoldSchema);
