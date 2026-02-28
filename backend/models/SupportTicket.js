import mongoose from "mongoose";

const { Schema, model } = mongoose;

const supportTicketEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["CREATED", "ASSIGNED", "ESCALATED", "LINKED_INCIDENT", "COMMENT", "RESOLVED"],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new Schema(
  {
    ticketKey: { type: String, required: true, unique: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true, default: null },
    category: {
      type: String,
      enum: ["ACCOUNT", "INTEGRATION", "BILLING", "TRAINING", "CLINICAL", "OTHER"],
      default: "OTHER",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "ESCALATED", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    linkedIncident: { type: Schema.Types.ObjectId, ref: "SreIncident", default: null, index: true },
    source: { type: String, default: "MANUAL" },
    resolvedAt: { type: Date, default: null },
    events: { type: [supportTicketEventSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

supportTicketSchema.index({ hospital: 1, status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ requester: 1, createdAt: -1 });
supportTicketSchema.index({ assignee: 1, status: 1, updatedAt: -1 });

export default mongoose.models.SupportTicket || model("SupportTicket", supportTicketSchema);
