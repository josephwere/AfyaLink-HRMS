import mongoose from "mongoose";

const { Schema, model } = mongoose;

const hospitalBroadcastSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    audience: {
      type: [String],
      default: ["ALL_PATIENTS"],
    },
    channels: {
      type: [String],
      default: ["IN_APP"],
      enum: ["EMAIL", "SMS", "PUSH", "IN_APP", "WHATSAPP"],
    },
    campaignType: {
      type: String,
      enum: ["IMMEDIATE", "SCHEDULED", "RECURRING"],
      default: "IMMEDIATE",
      index: true,
    },
    frequency: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
      default: null,
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "SENT", "FAILED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

hospitalBroadcastSchema.index({ hospitalId: 1, status: 1, scheduledAt: 1 });

const HospitalBroadcast =
  mongoose.models.HospitalBroadcast ||
  model("HospitalBroadcast", hospitalBroadcastSchema);

export default HospitalBroadcast;
