import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    encounter: { type: mongoose.Schema.Types.ObjectId, ref: "Encounter" },

    items: [
      {
        description: String,
        amount: Number,
        quantity: { type: Number, default: 1 },
      },
    ],

    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ["Unpaid", "Paid", "Cancelled"],
      default: "Unpaid",
      index: true,
    },

    paidAt: Date,
  },
  { timestamps: true }
);

/* 🔒 HARD GUARD */
InvoiceSchema.pre("save", function (next) {
  if (!this.$locals?.viaWorkflow) {
    return next(new Error("Invoice must be created via workflow"));
  }
  next();
});

export default mongoose.model("Invoice", InvoiceSchema);
