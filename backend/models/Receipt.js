import mongoose from "mongoose";

const { Schema, model } = mongoose;

/* ======================================================
   RECEIPT SCHEMA (ACCOUNTING-GRADE)
====================================================== */
const ReceiptSchema = new Schema(
  {
    receiptNo: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },

    patient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "KES",
    },

    method: {
      type: String, // mpesa, stripe, cash
      required: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/* ======================================================
   HARD GUARANTEES (NON-NEGOTIABLE)
====================================================== */

/**
 * 🔒 RULE 1: Receipt can ONLY be created via workflow
 */
ReceiptSchema.pre("save", function (next) {
  if (this.isNew) {
    if (!this.$locals?.viaWorkflow) {
      return next(
        new Error("Receipt creation forbidden outside workflow engine")
      );
    }
  } else {
    return next(
      new Error("Receipt is immutable and cannot be modified")
    );
  }
  next();
});

/**
 * 🔒 RULE 2: Absolutely no deletes
 */
ReceiptSchema.pre("deleteOne", { document: true }, function (next) {
  next(new Error("Receipt deletion is forbidden"));
});

/**
 * 🔒 RULE 3: Block dangerous query mutations
 */
ReceiptSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany", "findByIdAndUpdate"],
  function (next) {
    next(new Error("Receipt mutation forbidden"));
  }
);

/* ======================================================
   SAFE EXPORT
====================================================== */
const Receipt =
  mongoose.models.Receipt || model("Receipt", ReceiptSchema);

export default Receipt;
