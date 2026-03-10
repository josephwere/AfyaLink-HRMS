import mongoose from "mongoose";

const { Schema, model } = mongoose;

const systemSettingsSchema = new Schema(
  {
    key: { type: String, default: "GLOBAL", index: true },
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
    communications: {
      callsEnabled: { type: Boolean, default: true },
      videoCallsEnabled: { type: Boolean, default: true },
      voiceCallsEnabled: { type: Boolean, default: true },
    },
    clinical: {
      closeoutPolicy: {
        requireDiagnosisBeforeClose: { type: Boolean, default: true },
        requireBillingHandoffWhenPaymentsEnabled: { type: Boolean, default: true },
        requirePrescriptionWhenPharmacyEnabled: { type: Boolean, default: false },
      },
    },
    monetization: {
      strategy: { type: String, default: "CORE_FREE_PREMIUM_ADDONS" },
      enforceUsageLimits: { type: Boolean, default: false },
      featureAccess: {
        type: Map,
        of: {
          type: String,
          enum: ["FREE", "PREMIUM"],
        },
        default: {
          ai: "PREMIUM",
          payments: "FREE",
          pharmacy: "FREE",
          inventory: "FREE",
          lab: "FREE",
          realtime: "PREMIUM",
          auditLogs: "PREMIUM",
          adminCreation: "FREE",
          advertising: "PREMIUM",
          recruitmentAds: "PREMIUM",
          advancedAnalytics: "PREMIUM",
          heavyExports: "PREMIUM",
        },
      },
    },
  },
  { timestamps: true }
);

export default model("SystemSettings", systemSettingsSchema);
