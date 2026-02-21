import mongoose from "mongoose";

const Schema = new mongoose.Schema(
  {
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: "Encounter" },
    provider: { type: String }, // NHIF, Jubilee, etc
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    reference: String,
  },
  { timestamps: true }
);

export default mongoose.model("InsuranceAuthorization", Schema);
