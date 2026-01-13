import mongoose from "mongoose";
const { Schema, model } = mongoose;

const incidentSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },

    incidentType: {
      type: String,
      enum: [
        "UNAUTHORIZED_ACCESS",
        "OVERSTAY",
        "ASSAULT",
        "THEFT",
        "EMERGENCY_BYPASS_ABUSE",
        "SUSPICIOUS_BEHAVIOR",
      ],
      index: true,
    },

    accessEntry: { type: Schema.Types.ObjectId, ref: "AccessEntry" },
    involvedPersons: [Schema.Types.ObjectId],

    description: String,

    evidence: [
      {
        type: { type: String }, // photo, video, document
        url: String,
        capturedAt: Date,
      },
    ],

    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      index: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED"],
      default: "OPEN",
      index: true,
    },

    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model("SecurityIncident", incidentSchema);
