import mongoose from "mongoose";

const { Schema, model } = mongoose;

const chwPerformanceLogSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    chw: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    periodDate: { type: Date, required: true, index: true },
    householdsAssigned: { type: Number, default: 0 },
    visitsCompleted: { type: Number, default: 0 },
    missedVisits: { type: Number, default: 0 },
    vaccinationsAdministered: { type: Number, default: 0 },
    referralsMade: { type: Number, default: 0 },
    maternalFollowUps: { type: Number, default: 0 },
    diseaseReportingTimeliness: { type: Number, default: 0 },
    gpsComplianceScore: { type: Number, default: 0 },
    supervisorRating: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

chwPerformanceLogSchema.index({ hospital: 1, chw: 1, periodDate: -1 });

export default mongoose.models.ChwPerformanceLog ||
  model("ChwPerformanceLog", chwPerformanceLogSchema);

