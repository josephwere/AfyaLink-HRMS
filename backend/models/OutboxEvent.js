import mongoose from "mongoose";
const { Schema, model } = mongoose;

const outboxEventSchema = new Schema({
  aggregateId: { type: String, required: true, index: true },
  aggregateType: { type: String, required: true, default: "Invoice" },
  eventName: { type: String, required: true, index: true },
  payload: { type: Object, default: {} },
  status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING", index: true },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  nextAttemptAt: { type: Date, default: null },
}, { timestamps: true });

export default model("OutboxEvent", outboxEventSchema);
