import mongoose from "mongoose";

export const GOVERNMENT_STAFF_ROLES = Object.freeze([
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
]);

const governmentStaffSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: GOVERNMENT_STAFF_ROLES,
      required: true,
      index: true,
    },
    agency: {
      type: String,
      trim: true,
      default: "Ministry of Health",
      index: true,
    },
    department: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    employeeId: { type: String, trim: true, default: "", index: true },
    jurisdiction: {
      country: { type: String, trim: true, default: "KE", index: true },
      region: { type: String, trim: true, default: "" },
      county: { type: String, trim: true, default: "" },
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

governmentStaffSchema.index({ agency: 1, role: 1, status: 1 });
governmentStaffSchema.index({ "jurisdiction.country": 1, "jurisdiction.region": 1, role: 1 });

export default mongoose.models.GovernmentStaff ||
  mongoose.model("GovernmentStaff", governmentStaffSchema);
