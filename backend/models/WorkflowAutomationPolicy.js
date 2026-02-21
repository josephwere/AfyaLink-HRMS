import mongoose from "mongoose";
import { WORKFORCE_REQUEST_TYPES } from "../constants/workforceSLA.js";

const { Schema, model } = mongoose;

const workflowAutomationPolicySchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    requestType: {
      type: String,
      enum: WORKFORCE_REQUEST_TYPES,
      required: true,
      index: true,
    },
    active: { type: Boolean, default: true },
    autoApprove: { type: Boolean, default: false },
    requireSecondApprover: { type: Boolean, default: false },
    fallbackRole: {
      type: String,
      enum: [
        "",
        "AUTO",
        "HOSPITAL_ADMIN",
        "SYSTEM_ADMIN",
        "SUPER_ADMIN",
        "HR_MANAGER",
        "PAYROLL_OFFICER",
      ],
      default: "",
    },
    escalationAfterMinutes: { type: Number, default: 120 },
    conditions: {
      maxLeaveDays: { type: Number, default: 0 },
      maxOvertimeHours: { type: Number, default: 0 },
      allowedShiftTypes: { type: [String], default: [] },
      fallbackCandidates: { type: [String], default: [] },
      priorityAgeMultiplier: { type: Number, default: 1 },
      priorityWeightCap: { type: Number, default: 5 },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workflowAutomationPolicySchema.index({ hospital: 1, requestType: 1 }, { unique: true });

export default model("WorkflowAutomationPolicy", workflowAutomationPolicySchema);
