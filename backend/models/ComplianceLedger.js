import mongoose from "mongoose";

const { Schema, model } = mongoose;

const complianceLedgerSchema = new Schema(
  {
    tenantKey: {
      type: String,
      index: true,
      required: true,
    },
    chainIndex: {
      type: Number,
      index: true,
      required: true,
    },
    prevHash: {
      type: String,
      default: "",
      immutable: true,
    },
    entryHash: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    actorRole: {
      type: String,
      index: true,
    },
    resource: {
      type: String,
      index: true,
    },
    resourceId: {
      type: Schema.Types.Mixed,
      index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },
    metadata: {
      type: Object,
      default: {},
      immutable: true,
    },
  },
  { timestamps: true, minimize: false }
);

complianceLedgerSchema.index({ tenantKey: 1, chainIndex: -1 }, { unique: true });
complianceLedgerSchema.index({ tenantKey: 1, createdAt: -1 });

complianceLedgerSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne"],
  function () {
    throw new Error("ComplianceLedger entries are immutable");
  }
);

complianceLedgerSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete", "findByIdAndDelete"],
  function () {
    throw new Error("ComplianceLedger entries cannot be deleted");
  }
);

const ComplianceLedger =
  mongoose.models.ComplianceLedger ||
  model("ComplianceLedger", complianceLedgerSchema);

export default ComplianceLedger;
