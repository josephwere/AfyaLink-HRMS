import mongoose from "mongoose";

const { Schema, model } = mongoose;

const systemSettingsSchema = new Schema(
  {
    branding: {
      appIcon: String,
      favicon: String,
      logo: String,
      loginBackground: String,
      homeBackground: String,
      sidebarIcons: {
        type: Map,
        of: String,
        default: {},
      },
    },
    ai: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: "NeuroEdge" },
      url: { type: String, default: "" },
      provider: { type: String, default: "NeuroEdge" },
      model: { type: String, default: "neuroedge-core" },
      extractionEnabled: { type: Boolean, default: true },
      digitalTwinEnabled: { type: Boolean, default: false },
      greeting: { type: String, default: "Hi, how can I help?" },
    },
  },
  { timestamps: true }
);

export default model("SystemSettings", systemSettingsSchema);
