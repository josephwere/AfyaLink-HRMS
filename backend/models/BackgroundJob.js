import mongoose from "mongoose";

const { Schema, model } = mongoose;

const backgroundJobSchema = new Schema(
  {
    type: { type: String, required: true, trim: true, index: true },
    queue: { type: String, trim: true, default: "default", index: true },
    status: {
      type: String,
      enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELLED"],
      default: "QUEUED",
      index: true,
    },
    priority: { type: Number, default: 50, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: null },
    source: { type: String, trim: true, default: "" },
    dedupeKey: { type: String, trim: true, default: "", index: true },
    tags: { type: [String], default: [] },
    runAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null, index: true },
    lockedBy: { type: String, trim: true, default: "" },
    leaseExpiresAt: { type: Date, default: null, index: true },
    attemptsMade: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    backoffMs: { type: Number, default: 60000 },
    lastError: {
      message: { type: String, trim: true, default: "" },
      code: { type: String, trim: true, default: "" },
      stack: { type: String, default: "" },
      at: { type: Date, default: null },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true, minimize: false }
);

backgroundJobSchema.index({ status: 1, runAt: 1, priority: 1, createdAt: 1 });
backgroundJobSchema.index({ queue: 1, status: 1, runAt: 1 });
backgroundJobSchema.index(
  { dedupeKey: 1, status: 1 },
  {
    partialFilterExpression: {
      dedupeKey: { $type: "string", $ne: "" },
      status: { $in: ["QUEUED", "RUNNING"] },
    },
  }
);

export default model("BackgroundJob", backgroundJobSchema);
