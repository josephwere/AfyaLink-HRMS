import mongoose from "mongoose";

const { Schema, model } = mongoose;

const branchSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

branchSchema.index({ hospital: 1, name: 1 }, { unique: false });

export default mongoose.models.Branch || model("Branch", branchSchema);
