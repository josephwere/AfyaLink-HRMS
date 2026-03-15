import mongoose from "mongoose";

const ClaimRuleSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: "" }, // empty = global
    ruleType: {
      type: String,
      enum: ["MAX_PER_WINDOW", "AGE_LIMIT", "GENDER_ONLY", "COOLDOWN_DAYS"],
      required: true,
      index: true,
    },
    procedureCode: { type: String, trim: true, default: "" },
    procedureCategory: { type: String, trim: true, default: "" },
    maxPerWindow: { type: Number, default: null },
    windowDays: { type: Number, default: null },
    minAge: { type: Number, default: null },
    maxAge: { type: Number, default: null },
    allowedGenders: { type: [String], default: [] },
    cooldownDays: { type: Number, default: null },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    enabled: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

ClaimRuleSchema.index({ country: 1, ruleType: 1, procedureCode: 1, procedureCategory: 1 });

export default mongoose.model("ClaimRule", ClaimRuleSchema);
