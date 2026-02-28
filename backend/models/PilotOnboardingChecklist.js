import mongoose from "mongoose";

const { Schema, model } = mongoose;

const checklistItemSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const pilotOnboardingChecklistSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "READY_FOR_GO_LIVE", "COMPLETED"],
      default: "NOT_STARTED",
      index: true,
    },
    phase: { type: String, default: "PILOT" },
    items: { type: [checklistItemSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

pilotOnboardingChecklistSchema.index({ hospital: 1, updatedAt: -1 });
pilotOnboardingChecklistSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.models.PilotOnboardingChecklist ||
  model("PilotOnboardingChecklist", pilotOnboardingChecklistSchema);
