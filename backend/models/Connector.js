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

    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    url: {
      type: String,
      trim: true,
      default: "",
    },

    authType: {
      type: String,
      enum: ["none", "apikey", "basic"],
      default: "none",
    },

    apiKey: String,
    username: String,
    password: String,

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

ConnectorSchema.index({ hospitalId: 1, type: 1, isActive: 1 });

export default mongoose.model("Connector", ConnectorSchema);
