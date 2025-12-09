import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  nurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
  date: { type: Date, required: true },
  status: { type: String, enum: ["pending", "approved", "cancelled", "completed"], default: "pending" },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Appointment", appointmentSchema);
