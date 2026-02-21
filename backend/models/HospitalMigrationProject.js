import mongoose from "mongoose";

const { Schema, model } = mongoose;

const migrationProjectSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sourceSystem: {
      name: { type: String, trim: true, default: "" },
      vendor: { type: String, trim: true, default: "" },
      type: {
        type: String,
        enum: ["HIS", "EMR", "LIS", "PACS", "PAYROLL", "OTHER"],
        default: "OTHER",
      },
      connectorId: { type: Schema.Types.ObjectId, ref: "Connector" },
      interoperability: {
        type: [String],
        default: [],
      }, // FHIR, HL7v2, CSV, API
    },
    strategy: {
      mode: {
        type: String,
        enum: ["MANUAL", "AI_ASSISTED", "HYBRID"],
        default: "HYBRID",
      },
      aiEngine: { type: String, default: "NEUROEDGE" },
      dualWrite: { type: Boolean, default: true },
      cutoverWindow: {
        startAt: Date,
        endAt: Date,
      },
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "CONNECTING",
        "MAPPING",
        "DRY_RUN",
        "PARALLEL_RUN",
        "CUTOVER_READY",
        "CUTOVER_DONE",
        "ROLLBACK",
        "PAUSED",
      ],
      default: "DRAFT",
      index: true,
    },
    progress: {
      recordsScanned: { type: Number, default: 0 },
      recordsMigrated: { type: Number, default: 0 },
      recordsErrored: { type: Number, default: 0 },
      mappingCoveragePct: { type: Number, default: 0 },
      verificationCoveragePct: { type: Number, default: 0 },
      lastRunAt: Date,
    },
    notes: { type: String, default: "" },
    risks: [{ type: String }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true }
);

migrationProjectSchema.index({ hospital: 1, createdAt: -1 });
migrationProjectSchema.index({ hospital: 1, status: 1, updatedAt: -1 });

const HospitalMigrationProject =
  mongoose.models.HospitalMigrationProject ||
  model("HospitalMigrationProject", migrationProjectSchema);

export default HospitalMigrationProject;
