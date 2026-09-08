import mongoose from "mongoose";

const { Schema, model } = mongoose;

const hospitalNotificationLogSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["EMAIL", "SMS", "PUSH", "IN_APP", "WHATSAPP"],
      required: true,
      index: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "HospitalCommunicationTemplate",
      default: null,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "HospitalBroadcast",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      trim: true,
      default: "CUSTOM",
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ["QUEUED", "SENT", "FAILED"],
      default: "QUEUED",
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    failureReason: {
      type: String,
      trim: true,
      default: "",
    },
    sentAt: {
      type: Date,
      default: null,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    openedAt: {
      type: Date,
      default: null,
      index: true,
    },
    clickedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

hospitalNotificationLogSchema.index({ hospitalId: 1, createdAt: -1 });

const HospitalNotificationLog =
  mongoose.models.HospitalNotificationLog ||
  model("HospitalNotificationLog", hospitalNotificationLogSchema);

export default HospitalNotificationLog;
