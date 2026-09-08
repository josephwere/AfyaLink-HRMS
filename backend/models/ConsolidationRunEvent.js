import mongoose from "mongoose";
const { Schema, model } = mongoose;

const consolidationRunEventSchema = new Schema({
  consolidationRunId: { type: Schema.Types.ObjectId, ref: "ConsolidationRun", required: true, index: true },
  eventType: { type: String, required: true },
  data: { type: Object, default: {} },
  createdBy: { type: String, default: "system" },
  createdRole: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

export default model("ConsolidationRunEvent", consolidationRunEventSchema);
