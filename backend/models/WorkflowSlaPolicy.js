import mongoose from "mongoose";
import {
  WORKFORCE_REQUEST_TYPES,
  WORKFORCE_SLA_DEFAULTS,
} from "../constants/workforceSLA.js";

const { Schema, model } = mongoose;

const workflowSlaPolicySchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: WORKFORCE_REQUEST_TYPES,
      required: true,
      index: true,
    },
    targetMinutes: {
      type: Number,
      min: 1,
      required: true,
    },
    escalationMinutes: {
      type: Number,
      min: 1,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

workflowSlaPolicySchema.index({ hospital: 1, requestType: 1 }, { unique: true });

workflowSlaPolicySchema.statics.defaultsFor = function defaultsFor(type) {
  return WORKFORCE_SLA_DEFAULTS[type] || null;
};

export default model("WorkflowSlaPolicy", workflowSlaPolicySchema);
