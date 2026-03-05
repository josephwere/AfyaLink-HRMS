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
      enum: [
        "mpesa",
        "sms",
        "email",
        "webhook",
        "custom",
        "fhir",
        "hl7",
        "dicom",
        "lis",
        "his",
        "emr",
      ],
    },
    profile: {
      type: String,
      enum: ["FHIR_R4", "HL7_V2", "DICOM", "REST", "CSV", "CUSTOM"],
      default: "CUSTOM",
    },
    capabilities: {
      canPull: { type: Boolean, default: false },
      canPush: { type: Boolean, default: true },
      supportsWebhook: { type: Boolean, default: true },
      supportsBatch: { type: Boolean, default: false },
      supportsRealtime: { type: Boolean, default: true },
      supportsDeltaSync: { type: Boolean, default: false },
    },

    config: {
      type: Object,
      default: {},
    },
    runtime: {
      mode: {
        type: String,
        enum: ["SHADOW", "MIRROR", "CUTOVER", "ROLLBACK", "PAUSED"],
        default: "SHADOW",
      },
      dryRun: { type: Boolean, default: true },
      lastCursor: { type: String, default: "" },
      lastSuccessAt: { type: Date, default: null },
      lastErrorAt: { type: Date, default: null },
      lastError: { type: String, default: "" },
      migrationProjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HospitalMigrationProject",
      },
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
ConnectorSchema.index({ hospitalId: 1, profile: 1, isActive: 1 });
ConnectorSchema.index({ hospitalId: 1, "runtime.mode": 1, isActive: 1 });

export default mongoose.model("Connector", ConnectorSchema);
