import mongoose from "mongoose";

const wardSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["GENERAL", "ICU", "HDU", "MATERNITY", "PEDIATRIC", "EMERGENCY", "SURGICAL", "ISOLATION", "OTHER"],
      default: "GENERAL",
      index: true,
    },
    capacity: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

wardSchema.index({ hospital: 1, name: 1 }, { unique: true });
wardSchema.index({ hospital: 1, active: 1, type: 1 });

export default mongoose.models.Ward || mongoose.model("Ward", wardSchema);
