import mongoose from "mongoose";

const { Schema, model } = mongoose;

const staffTransferLetterSchema = new Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    sha256: { type: String, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    signature: {
      provided: { type: Boolean, default: false },
      value: { type: String, default: "" },
      algorithm: { type: String, default: "RSA-SHA256" },
      verified: { type: Boolean, default: false, index: true },
      reason: { type: String, default: null },
      verifiedAt: Date,
      keyId: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

staffTransferLetterSchema.index({ hospital: 1, createdAt: -1 });

export default model("StaffTransferLetter", staffTransferLetterSchema);

