import mongoose from "mongoose";

const { Schema, model } = mongoose;

const fieldVisitSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    household: { type: Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    category: {
      type: String,
      enum: ["GENERAL", "MATERNAL_CHILD", "VACCINATION", "CHRONIC", "SURVEILLANCE"],
      default: "GENERAL",
      index: true,
    },
    status: { type: String, enum: ["PENDING", "COMPLETED", "MISSED"], default: "PENDING", index: true },
    notes: { type: String, default: "", trim: true },
    nextActionDate: { type: Date, default: null },
    vitals: {
      bp: String,
      sugar: String,
      pulse: String,
      temperature: String,
      spo2: String,
    },
    gps: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      capturedAt: { type: Date, default: null },
    },
    attachments: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

fieldVisitSchema.index({ hospital: 1, chw: 1, createdAt: -1 });
fieldVisitSchema.index({ hospital: 1, category: 1, status: 1, createdAt: -1 });

export default mongoose.models.FieldVisit || model("FieldVisit", fieldVisitSchema);

