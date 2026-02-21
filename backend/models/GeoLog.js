import mongoose from "mongoose";

const { Schema, model } = mongoose;

const geoLogSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: String, default: "VISIT_LOG", trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    note: { type: String, default: "", trim: true },
    capturedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

geoLogSchema.index({ hospital: 1, chw: 1, capturedAt: -1 });

export default mongoose.models.GeoLog || model("GeoLog", geoLogSchema);

