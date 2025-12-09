import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
  age: Number,
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  contact: String,
  address: String,
  medicalHistory: [{ type: String }],
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedNurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Patient", patientSchema);
