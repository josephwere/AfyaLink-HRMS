import mongoose from "mongoose";

const { Schema, model } = mongoose;

const printerProfileSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    provider: {
      type: String,
      enum: ["BROWSER", "IPP", "QZ_TRAY", "CUPS", "PDF"],
      default: "BROWSER",
      index: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    config: {
      ippUrl: { type: String, default: "" },
      queueName: { type: String, default: "" },
      paperSize: { type: String, default: "A4" },
      duplex: { type: Boolean, default: false },
      color: { type: Boolean, default: true },
      copiesDefault: { type: Number, default: 1, min: 1, max: 20 },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

printerProfileSchema.index({ hospital: 1, name: 1 }, { unique: true });
printerProfileSchema.index({ hospital: 1, isDefault: 1, enabled: 1 });

export default mongoose.models.PrinterProfile ||
  model("PrinterProfile", printerProfileSchema);

