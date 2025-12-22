import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["doctor", "nurse", "labtech"],
    required: true,
  },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Staff", staffSchema);
