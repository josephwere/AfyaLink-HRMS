import mongoose from "mongoose";

const labTestSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // usually doctor
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // labtech
  testType: { type: String, required: true },
  results: String,
  status: { type: String, enum: ["pending", "inprogress", "completed"], default: "pending" },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("LabTest", labTestSchema);
