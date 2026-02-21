import mongoose from "mongoose";

const { Schema, model } = mongoose;

const diseaseReportSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    disease: { type: String, required: true, trim: true },
    suspectedCases: { type: Number, default: 1 },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
    location: { type: String, default: "", trim: true },
    ward: { type: String, default: "", trim: true },
    symptoms: { type: [String], default: [] },
    notes: { type: String, default: "", trim: true },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    reportedToPublicHealth: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

diseaseReportSchema.index({ hospital: 1, createdAt: -1 });
diseaseReportSchema.index({ hospital: 1, disease: 1, severity: 1 });

export default mongoose.models.DiseaseReport ||
  model("DiseaseReport", diseaseReportSchema);

