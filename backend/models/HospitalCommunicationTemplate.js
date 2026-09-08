import mongoose from "mongoose";

const { Schema, model } = mongoose;

const hospitalCommunicationTemplateSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "APPOINTMENT_CONFIRMED",
        "APPOINTMENT_REMINDER",
        "APPOINTMENT_COMPLETED",
        "APPOINTMENT_CANCELLED",
        "NEW_SERVICE",
        "HOLIDAY_CLOSURE",
        "BROADCAST",
        "CUSTOM",
      ],
      index: true,
    },
    channel: {
      type: String,
      required: true,
      trim: true,
      enum: ["EMAIL", "SMS", "PUSH", "IN_APP", "WHATSAPP"],
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    placeholders: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

hospitalCommunicationTemplateSchema.index(
  { hospitalId: 1, eventType: 1, channel: 1, isActive: 1 },
  { unique: true, sparse: true }
);

const HospitalCommunicationTemplate =
  mongoose.models.HospitalCommunicationTemplate ||
  model("HospitalCommunicationTemplate", hospitalCommunicationTemplateSchema);

export default HospitalCommunicationTemplate;
