import mongoose from "mongoose";
import { STAFF_ROLES } from "../utils/roleSets.js";

const staffSchema = new mongoose.Schema(
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
      enum: STAFF_ROLES,
      required: true,
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "TRANSFER_PENDING"],
      default: "ACTIVE",
      index: true,
    },
    employeeId: { type: String, trim: true, default: "", index: true },
    department: { type: String, trim: true, default: "" },
    licenseNumber: { type: String, trim: true, default: "" },
    licenseExpiry: Date,
    checklist: {
      compliant: { type: Boolean, default: false },
      completionRate: { type: Number, default: 0 },
      missingKeys: { type: [String], default: [] },
      missingLabels: { type: [String], default: [] },
      evaluatedAt: Date,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

staffSchema.index({ hospital: 1, role: 1, status: 1 });
staffSchema.index({ hospital: 1, employeeId: 1 }, { sparse: true });

export default mongoose.models.Staff || mongoose.model("Staff", staffSchema);
