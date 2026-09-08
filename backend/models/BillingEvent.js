import mongoose from "mongoose";

const { Schema, model } = mongoose;

const billingEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    aggregateId: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true, index: true },
    eventName: { type: String, required: true, index: true },
    version: { type: Number, default: 1, index: true },
    payload: { type: Object, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
    actor: { type: String, default: null },
    correlationId: { type: String, default: null, index: true },
    causationId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

const BillingEvent = mongoose.models.BillingEvent || model("BillingEvent", billingEventSchema);

export default BillingEvent;
