import mongoose from "mongoose";

const { Schema, model } = mongoose;

const transferActionSchema = new Schema(
  {
    action: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const staffTransferRequestSchema = new Schema(
  {
    staffUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentRole: { type: String, required: true },
    fromHospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    toHospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transferLetterRef: { type: String, default: "" },
    transferLetter: {
      letterId: { type: Schema.Types.ObjectId, ref: "StaffTransferLetter" },
      sha256: { type: String, default: "" },
      signatureVerified: { type: Boolean, default: false },
      signatureReason: { type: String, default: null },
    },
    note: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "PENDING_SOURCE_APPROVAL",
        "PENDING_TARGET_APPROVAL",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING_SOURCE_APPROVAL",
      index: true,
    },
    sourceApproval: {
      by: { type: Schema.Types.ObjectId, ref: "User" },
      at: Date,
      note: { type: String, default: "" },
    },
    targetApproval: {
      by: { type: Schema.Types.ObjectId, ref: "User" },
      at: Date,
      note: { type: String, default: "" },
    },
    completedAt: Date,
    rejectedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, default: "" },
    actions: { type: [transferActionSchema], default: [] },
  },
  { timestamps: true }
);

staffTransferRequestSchema.index({ staffUser: 1, createdAt: -1 });
staffTransferRequestSchema.index({ fromHospital: 1, status: 1, createdAt: -1 });
staffTransferRequestSchema.index({ toHospital: 1, status: 1, createdAt: -1 });

export default model("StaffTransferRequest", staffTransferRequestSchema);
