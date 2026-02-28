import mongoose from "mongoose";

const { Schema, model } = mongoose;

const incidentEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["DECLARED", "ACKED", "ESCALATED", "MITIGATED", "RESOLVED", "COMMENT"],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sreIncidentSchema = new Schema(
  {
    incidentKey: { type: String, required: true, unique: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true, default: null },
    service: { type: String, required: true, index: true, default: "afyalink-backend" },
    severity: {
      type: String,
      enum: ["SEV1", "SEV2", "SEV3", "SEV4"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "ACKED", "MITIGATED", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    summary: { type: String, required: true },
    sourceAlert: { type: String, default: "" },
    runbookUrl: { type: String, default: "" },
    commander: { type: Schema.Types.ObjectId, ref: "User", required: true },
    commsOwner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedAt: { type: Date, default: null },
    mitigatedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    events: { type: [incidentEventSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

sreIncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });
sreIncidentSchema.index({ service: 1, status: 1, createdAt: -1 });
sreIncidentSchema.index({ hospital: 1, status: 1, createdAt: -1 });

export default mongoose.models.SreIncident || model("SreIncident", sreIncidentSchema);
