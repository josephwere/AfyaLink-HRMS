import mongoose from "mongoose";
const { Schema, model } = mongoose;

const subscriptionSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    plan: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "PAST_DUE", "CANCELED", "TRIAL"],
      default: "ACTIVE",
      index: true,
    },

    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },

    provider: {
      type: String,
      enum: ["MANUAL", "MPESA", "STRIPE"],
      default: "MANUAL",
    },

    currentPeriodEnd: Date,

    metadata: Object, // M-Pesa / Stripe refs later
  },
  { timestamps: true }
);

export default model("Subscription", subscriptionSchema);
