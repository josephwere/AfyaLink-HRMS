import mongoose from "mongoose";
const { Schema, model } = mongoose;

const breakGlassSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    activatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      required: true,
      minlength: 10,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    metadata: Object,
  },
  { timestamps: true }
);

export default model("BreakGlass", breakGlassSchema);
