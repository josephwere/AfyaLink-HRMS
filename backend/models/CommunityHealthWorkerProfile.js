import mongoose from "mongoose";

const { Schema, model } = mongoose;

const communityHealthWorkerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    assignedCommunityArea: { type: String, default: "", trim: true },
    ward: { type: String, default: "", trim: true },
    subCounty: { type: String, default: "", trim: true },
    assignedSupervisor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    contractType: { type: String, default: "CONTRACT", trim: true },
    employmentStatus: { type: String, default: "ACTIVE", trim: true },
    salaryOrStipend: { type: Number, default: 0 },
    reportingSchedule: { type: String, default: "DAILY", trim: true },
    ministryAccreditationNumber: { type: String, default: "", trim: true },
    certificationStatus: { type: String, default: "PENDING", trim: true },
    deviceId: { type: String, default: "", trim: true },
    simCardNumber: { type: String, default: "", trim: true },
    vaccineCarrierId: { type: String, default: "", trim: true },
    gpsDeviceId: { type: String, default: "", trim: true },
    ppeAllocationLog: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

communityHealthWorkerProfileSchema.index({ hospital: 1, assignedCommunityArea: 1 });

export default mongoose.models.CommunityHealthWorkerProfile ||
  model("CommunityHealthWorkerProfile", communityHealthWorkerProfileSchema);

