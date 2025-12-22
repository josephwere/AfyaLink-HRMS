import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   HARD WORKFLOW ASSERTION
   Ledger = Accounting Source of Truth
====================================================== */
function assertWorkflowContext(doc) {
  if (!doc.$locals?.viaWorkflow) {
    throw new Error(
      "SECURITY VIOLATION: LedgerEntry mutation must occur via paymentFinalizeService"
    );
  }
}

/* ======================================================
   LEDGER ENTRY SCHEMA (ACCOUNTING-GRADE)
====================================================== */
const ledgerEntrySchema = new Schema(
  {
    /* ==============================
       ENTRY TYPE
    ============================== */
    type: {
      type: String,
      enum: ["PAYMENT", "REFUND"],
      required: true,
      index: true,
    },

    /* ==============================
       AMOUNT
    ============================== */
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    /* ==============================
       TENANCY & SUBJECT
    ============================== */
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    patient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    /* ==============================
       REFERENCES
    ============================== */
    reference: {
      type: String, // receiptNo or refund ref
      index: true,
    },

    source: {
      type: String, // mpesa, stripe, cash
      index: true,
    },

    /* ==============================
       ACCOUNTING TIMESTAMP
    ============================== */
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    /* ==============================
       IMMUTABLE METADATA
    ============================== */
    metadata: {
      type: Object,
      default: {},
      immutable: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/* ======================================================
   INDEXES (FINANCIAL QUERIES)
====================================================== */

// Hospital revenue reports
ledgerEntrySchema.index(
  { hospital: 1, occurredAt: -1 },
  { name: "hospital_ledger_idx" }
);

// Patient financial history
ledgerEntrySchema.index(
  { patient: 1, occurredAt: -1 },
  { name: "patient_ledger_idx" }
);

// Receipt reconciliation
ledgerEntrySchema.index(
  { reference: 1 },
  { name: "reference_idx" }
);

/* ======================================================
   HARD IMMUTABILITY GUARANTEES
====================================================== */

// CREATE ONLY — MUST COME FROM PAYMENT FINALIZER
ledgerEntrySchema.pre("save", function (next) {
  if (this.isNew) {
    assertWorkflowContext(this);
  }
  next();
});

// ❌ UPDATES FORBIDDEN
ledgerEntrySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function () {
    throw new Error(
      "SECURITY VIOLATION: LedgerEntry is immutable after creation"
    );
  }
);

// ❌ DELETES FORBIDDEN
ledgerEntrySchema.pre(
  ["deleteOne", "findOneAndDelete", "remove"],
  function () {
    throw new Error(
      "SECURITY VIOLATION: LedgerEntry deletion is forbidden"
    );
  }
);

/* ======================================================
   SAFE EXPORT
====================================================== */
const LedgerEntry =
  mongoose.models.LedgerEntry ||
  model("LedgerEntry", ledgerEntrySchema);

export default LedgerEntry;
