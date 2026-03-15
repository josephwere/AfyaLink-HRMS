import mongoose from "mongoose";

const ClaimAuditLogSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: "Claim", index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    event: { type: String, trim: true, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    prevHash: { type: String, trim: true, default: "" },
    hash: { type: String, trim: true, required: true },
    sequence: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

ClaimAuditLogSchema.index({ claim: 1, sequence: 1 }, { unique: true });

export default mongoose.model("ClaimAuditLog", ClaimAuditLogSchema);
