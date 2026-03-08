import mongoose from "mongoose";

const { Schema, model } = mongoose;

const doctorAvailabilitySchema = new Schema(
  {
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
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
      default: "08:00",
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      default: "17:00",
    },
    appointmentSlots: {
      type: Number,
      default: 12,
      min: 0,
      max: 96,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    consultationAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    modes: {
      chat: { type: Boolean, default: true },
      voice: { type: Boolean, default: false },
      video: { type: Boolean, default: false },
      inPerson: { type: Boolean, default: true },
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

doctorAvailabilitySchema.index(
  { doctor: 1, hospital: 1, dayOfWeek: 1 },
  { unique: true, name: "doctor_hospital_day_unique" }
);

export default model("DoctorAvailability", doctorAvailabilitySchema);
