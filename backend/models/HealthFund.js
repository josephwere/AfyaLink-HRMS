import mongoose from "mongoose";

const healthFundSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, required: true, unique: true, index: true },
    name: { type: String, trim: true, required: true },
    country: { type: String, trim: true, uppercase: true, required: true, index: true },
    currency: { type: String, trim: true, uppercase: true, default: "KES" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    apiStatus: {
      type: String,
      enum: ["CONNECTED", "DEGRADED", "OFFLINE", "UNKNOWN"],
      default: "UNKNOWN",
      index: true,
    },
    endpoints: {
      patientRegistry: { type: String, trim: true, default: "" },
      hospitalRegistry: { type: String, trim: true, default: "" },
      claims: { type: String, trim: true, default: "" },
      reimbursements: { type: String, trim: true, default: "" },
    },
    contact: {
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    lastSyncAt: Date,
    notes: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

healthFundSchema.index({ country: 1, status: 1 });

export default mongoose.model("HealthFund", healthFundSchema);
