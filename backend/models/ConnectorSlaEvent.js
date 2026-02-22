import mongoose from "mongoose";

const connectorSlaEventSchema = new mongoose.Schema(
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
      index: true,
    },
    connectorType: {
      type: String,
      index: true,
    },
    operation: {
      type: String,
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: 0,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    ok: {
      type: Boolean,
      default: false,
      index: true,
    },
    breach: {
      type: Boolean,
      default: false,
      index: true,
    },
    breachReason: {
      type: String,
      default: null,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

connectorSlaEventSchema.index({ createdAt: -1 });
connectorSlaEventSchema.index({ hospitalId: 1, createdAt: -1 });
connectorSlaEventSchema.index({ connectorType: 1, operation: 1, createdAt: -1 });

export default mongoose.models.ConnectorSlaEvent ||
  mongoose.model("ConnectorSlaEvent", connectorSlaEventSchema);

