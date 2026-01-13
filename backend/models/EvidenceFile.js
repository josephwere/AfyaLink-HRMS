import mongoose from "mongoose";

const evidenceFileSchema = new mongoose.Schema({
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SecurityIncident",
  },
  fileUrl: String,
  hash: String,
  uploadedBy: ObjectId,
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("EvidenceFile", evidenceFileSchema);
