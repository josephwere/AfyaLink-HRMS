import mongoose from "mongoose";
import { generateInvoiceId } from "../services/idGenerator.js";

const InvoiceSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    invoiceId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

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
InvoiceSchema.pre("save", async function (next) {
  if (!this.invoiceId) {
    this.invoiceId = await generateInvoiceId();
  }

  if (!this.$locals?.viaWorkflow) {
    return next(new Error("Invoice must be created via workflow"));
  }
  next();
});

InvoiceSchema.pre("findOneAndUpdate", async function (next) {
  const options = this.getOptions();
  if (!options.upsert) return next();

  const update = this.getUpdate() || {};
  const hasInvoiceId =
    update.invoiceId !== undefined ||
    (update.$set && update.$set.invoiceId !== undefined) ||
    (update.$setOnInsert && update.$setOnInsert.invoiceId !== undefined);

  if (!hasInvoiceId) {
    const nextId = await generateInvoiceId();
    this.setUpdate({
      ...update,
      $setOnInsert: {
        ...(update.$setOnInsert || {}),
        invoiceId: nextId,
      },
    });
  }

  next();
});

export default mongoose.model("Invoice", InvoiceSchema);
