import mongoose from "mongoose";

const ConnectorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: ["mpesa", "sms", "email", "webhook", "custom"], // you can expand
    },

    config: {
      type: Object,
      default: {},
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSync: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Connector", ConnectorSchema);
