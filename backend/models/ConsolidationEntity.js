import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationEntitySchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["HOSPITAL", "GROUP", "LEGAL_ENTITY"], default: "HOSPITAL" },
  parentEntityId: { type: Schema.Types.ObjectId, default: null, index: true },
  currency: { type: String, default: "KES" },
  isActive: { type: Boolean, default: true },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

export default model("ConsolidationEntity", consolidationEntitySchema);
