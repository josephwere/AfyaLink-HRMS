import mongoose from "mongoose";
const { Schema, model } = mongoose;

const evidenceAnchorSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    resourceType: {
      type: String, // ACCESS_LOG | INCIDENT | PDF
      required: true,
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    hash: {
      type: String,
      required: true,
      index: true,
    },

    signature: {
      type: String,
      required: true,
    },

    blockchain: {
      type: String,
      default: "POLYGON",
    },

    txHash: {
      type: String,
      index: true,
    },

    anchoredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default model("EvidenceAnchor", evidenceAnchorSchema);
