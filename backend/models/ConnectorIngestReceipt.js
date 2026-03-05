import mongoose from "mongoose";

const connectorIngestReceiptSchema = new mongoose.Schema(
  {
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Connector",
      required: true,
      index: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    sourceEventId: {
      type: String,
      default: "",
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ["FHIR", "HL7", "JSON", "CSV", "CUSTOM"],
      default: "CUSTOM",
    },
    modeAtIngest: {
      type: String,
      enum: ["SHADOW", "MIRROR", "CUTOVER", "ROLLBACK", "PAUSED"],
      default: "SHADOW",
    },
    dryRun: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["ACCEPTED", "PROCESSED", "REJECTED"],
      default: "ACCEPTED",
    },
    summary: {
      type: Object,
      default: {},
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

connectorIngestReceiptSchema.index({ connectorId: 1, idempotencyKey: 1 }, { unique: true });
connectorIngestReceiptSchema.index({ hospitalId: 1, receivedAt: -1 });

export default
  mongoose.models.ConnectorIngestReceipt ||
  mongoose.model("ConnectorIngestReceipt", connectorIngestReceiptSchema);
