import mongoose from "mongoose";

const trainingDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1, max: 7 },
    title: { type: String, trim: true, default: "" },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const trainingTrackerSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
    traineeUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, default: null },
    traineeName: { type: String, trim: true, required: true },
    traineeEmail: { type: String, trim: true, lowercase: true, default: "" },
    traineeRole: { type: String, trim: true, uppercase: true, required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
      default: "NOT_STARTED",
      index: true,
    },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    days: { type: [trainingDaySchema], default: [] },
    trainerNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

trainingTrackerSchema.index({ hospital: 1, traineeRole: 1, updatedAt: -1 });
trainingTrackerSchema.index({ hospital: 1, status: 1, updatedAt: -1 });
trainingTrackerSchema.index({ traineeName: "text", traineeEmail: "text" });

export default mongoose.model("TrainingTracker", trainingTrackerSchema);
