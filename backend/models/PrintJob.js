import mongoose from "mongoose";

const { Schema, model } = mongoose;

const printJobSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    printerProfile: {
      type: Schema.Types.ObjectId,
      ref: "PrinterProfile",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["QUEUED", "SENT", "PRINTED", "FAILED", "CANCELED"],
      default: "QUEUED",
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    copies: {
      type: Number,
      min: 1,
      max: 20,
      default: 1,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: String,
      default: "",
    },
    printedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

printJobSchema.index({ hospital: 1, createdAt: -1 });
printJobSchema.index({ hospital: 1, status: 1, createdAt: -1 });

export default mongoose.models.PrintJob || model("PrintJob", printJobSchema);

