import mongoose from "mongoose";

const { Schema, model } = mongoose;

const callSessionSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    callType: {
      type: String,
      enum: ["VOICE", "VIDEO"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "ACTIVE", "ENDED", "TERMINATED"],
      default: "REQUESTED",
      index: true,
    },
    startedAt: Date,
    endedAt: Date,
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    blockedReason: {
      type: String,
      trim: true,
      default: "",
    },
    deletedAt: {
      type: Date,
      index: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true, minimize: false }
);

callSessionSchema.index({ hospital: 1, createdAt: -1 });
callSessionSchema.index({ doctor: 1, createdAt: -1 });
callSessionSchema.index({ patient: 1, createdAt: -1 });

export default model("CallSession", callSessionSchema);
