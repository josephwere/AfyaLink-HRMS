import mongoose from "mongoose";

const { Schema, model } = mongoose;

const cashierShiftSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    cashier: { type: Schema.Types.ObjectId, ref: "User", index: true },
    cashierName: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "CLOSED_BY_CASHIER",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "REOPENED",
      ],
      default: "OPEN",
      index: true,
    },
    openingFloat: { type: Number, default: 0 },
    openingTime: { type: Date, default: Date.now },
    openedAt: { type: Date, default: Date.now },
    expectedTotal: { type: Number, default: 0 },
    actualTotal: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    counts: { type: Schema.Types.Mixed, default: {} },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
    submittedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date,
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

cashierShiftSchema.index({ hospital: 1, cashier: 1, status: 1, updatedAt: -1 });

export default model("CashierShift", cashierShiftSchema);
