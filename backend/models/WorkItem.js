import mongoose from "mongoose";
const { Schema, model } = mongoose;

const commentSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const approvalHistorySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    action: String,
    comment: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workItemSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    type: { type: String, required: true, index: true }, // e.g., SHIFT_APPROVAL, REFUND_APPROVAL
    module: { type: String, default: "finance" },
    priority: { type: String, enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"], default: "MEDIUM", index: true },
    status: { type: String, enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"], default: "PENDING", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: Date,
    metadata: { type: Object, default: {} },
    actionUrl: { type: String, default: "" },
    comments: { type: [commentSchema], default: [] },
    currentLevel: { type: Number, default: 0 },
    overallStatus: { type: String, enum: ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"], default: "PENDING", index: true },
    assignments: {
      type: [
        new Schema(
          {
            level: { type: Number, required: true, index: true },
            approverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
            approverRole: { type: String, default: "" },
            status: { type: String, enum: ["WAITING", "PENDING", "APPROVED", "REJECTED", "DELEGATED", "EXPIRED"], default: "WAITING", index: true },
            delegatedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
            delegatedFrom: { type: Schema.Types.ObjectId, ref: "User", default: null },
            assignedAt: { type: Date, default: Date.now },
            viewedAt: Date,
            actionedAt: Date,
            dueAt: Date,
            comments: { type: [commentSchema], default: [] },
            signature: String,
            metadata: { type: Object, default: {} },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    // approval wiring
    requiredApprovals: { type: Number, default: 1 },
    approvalLevels: { type: Array, default: [] },
    approvalHistory: { type: [approvalHistorySchema], default: [] },
    slaHours: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workItemSchema.index({ hospital: 1, type: 1, status: 1, createdAt: -1 });
workItemSchema.index({ assignedTo: 1, status: 1 });

export default model("WorkItem", workItemSchema);
