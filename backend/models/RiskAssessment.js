import mongoose from "mongoose";
const { Schema, model } = mongoose;

const riskSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    accessEntry: { type: Schema.Types.ObjectId, ref: "AccessEntry", index: true },

    score: { type: Number, index: true }, // 0–100
    level: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      index: true,
    },

    factors: [String], // why score exists

    evaluatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default model("RiskAssessment", riskSchema);
