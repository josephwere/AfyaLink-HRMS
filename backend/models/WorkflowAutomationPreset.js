import mongoose from "mongoose";

const { Schema, model } = mongoose;

const workflowAutomationPresetSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    version: { type: Number, default: 1, min: 1 },
    active: { type: Boolean, default: true, index: true },
    config: {
      active: { type: Boolean, default: true },
      autoApprove: { type: Boolean, default: false },
      requireSecondApprover: { type: Boolean, default: true },
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
        default: "AUTO",
      },
      escalationAfterMinutes: { type: Number, default: 120 },
      conditions: {
        priorityAgeMultiplier: { type: Number, default: 1 },
        priorityWeightCap: { type: Number, default: 5 },
      },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workflowAutomationPresetSchema.index({ hospital: 1, key: 1 }, { unique: true });

export default model("WorkflowAutomationPreset", workflowAutomationPresetSchema);

