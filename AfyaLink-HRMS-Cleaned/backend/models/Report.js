import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // doctor or admin
  title: { type: String, required: true },
  description: String,
  files: [{ type: String }], // optional file URLs
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Report", reportSchema);
