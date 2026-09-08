import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
const { Schema, model } = mongoose;

const usageLedgerEntrySchema = new Schema(
  {
    type: { type: String, enum: ["USAGE"], default: "USAGE", required: true, index: true },
    // Tracing
    eventId: { type: String, required: true, default: () => uuidv4(), unique: true, index: true },
    requestId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", index: true },

    // Core tenancy and feature
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    feature: { type: String, required: true, index: true },
    // Immutable feature/service code used for billing (decoupled from displayName)
    serviceCode: { type: String, required: true, index: true },
    serviceName: { type: String, default: "" },
    category: { type: String, default: "" },

    // Usage quantites
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    freeTier: { type: Number, default: 0, min: 0 },
    chargeableQuantity: { type: Number, required: true, min: 0 },

    // Snapshot pricing (historical truth)
    catalogVersion: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountApplied: { type: Number, default: 0 },
    freeUnitsApplied: { type: Number, default: 0 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "KES" },
    billingMode: { type: String, default: "PER_REQUEST" },
    pricingVersion: { type: Number, default: 1 },
    pricingEffectiveFrom: { type: Date, default: () => new Date() },

    // Plan and invoice mapping
    plan: { type: String, default: "DEFAULT", index: true },
    invoiceMonth: { type: String, index: true },
    status: {
      type: String,
      enum: ["PENDING", "POSTED", "VOID", "REVERSAL"],
      default: "PENDING",
      index: true,
    },

    occurredAt: { type: Date, default: Date.now, index: true },
    metadata: { type: Object, default: {}, immutable: true },
  },
  { timestamps: true, minimize: false }
);

usageLedgerEntrySchema.pre("save", function (next) {
  if (!this.isNew) {
    return next(new Error("SECURITY VIOLATION: UsageLedgerEntry is immutable after creation"));
  }

  if (!this.invoiceMonth && this.occurredAt) {
    const occurredAt = new Date(this.occurredAt);
    this.invoiceMonth = `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, "0")}`;
  }

  next();
});

usageLedgerEntrySchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("SECURITY VIOLATION: UsageLedgerEntry update is forbidden");
});
usageLedgerEntrySchema.pre(["deleteOne", "findOneAndDelete", "remove"], function () {
  throw new Error("SECURITY VIOLATION: UsageLedgerEntry deletion is forbidden");
});

usageLedgerEntrySchema.index(
  { hospital: 1, invoiceMonth: 1, occurredAt: -1 },
  { name: "usage_hospital_invoice_month_idx" }
);

const UsageLedgerEntry =
  mongoose.models.UsageLedgerEntry || model("UsageLedgerEntry", usageLedgerEntrySchema);

export default UsageLedgerEntry;
