import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  contact: String,
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // hospital admin
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Hospital", hospitalSchema);
