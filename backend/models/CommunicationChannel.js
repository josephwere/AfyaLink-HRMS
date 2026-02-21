import mongoose from "mongoose";

const { Schema, model } = mongoose;

const communicationChannelSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    key: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    participantRoles: {
      type: [String],
      default: [],
      index: true,
    },
    participantUsers: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

communicationChannelSchema.index({ hospital: 1, active: 1, updatedAt: -1 });
communicationChannelSchema.index({ hospital: 1, key: 1 }, { unique: true, sparse: true });

const CommunicationChannel =
  mongoose.models.CommunicationChannel ||
  model("CommunicationChannel", communicationChannelSchema);

export default CommunicationChannel;
