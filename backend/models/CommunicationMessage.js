import mongoose from "mongoose";

const { Schema, model } = mongoose;

const communicationMessageSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: "CommunicationChannel",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    attachments: [
      {
        name: { type: String, trim: true, default: "" },
        url: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
      },
    ],
  },
  { timestamps: true }
);

communicationMessageSchema.index({ channel: 1, createdAt: -1, _id: -1 });
communicationMessageSchema.index({ hospital: 1, createdAt: -1 });

const CommunicationMessage =
  mongoose.models.CommunicationMessage ||
  model("CommunicationMessage", communicationMessageSchema);

export default CommunicationMessage;
