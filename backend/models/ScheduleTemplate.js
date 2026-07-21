import mongoose from "mongoose";

const { Schema, model } = mongoose;

const scheduleBlockSchema = new Schema(
  {
    startTime: { type: String, required: true, trim: true, default: "08:00" },
    endTime: { type: String, required: true, trim: true, default: "17:00" },
    durationMins: { type: Number, required: true, min: 5, max: 480, default: 30 },
    bufferMins: { type: Number, required: true, min: 0, max: 60, default: 5 },
    maxAppointments: { type: Number, default: 0, min: 0 },
    modes: {
      chat: { type: Boolean, default: true },
      voice: { type: Boolean, default: false },
      video: { type: Boolean, default: false },
      inPerson: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const scheduleTemplateSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    daysOfWeek: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
      validate: {
        validator: (values) => Array.isArray(values) && values.every((v) => Number.isInteger(v) && v >= 0 && v <= 6),
        message: "daysOfWeek must be an array of integers between 0 and 6",
      },
    },
    blocks: { type: [scheduleBlockSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

scheduleTemplateSchema.index({ hospital: 1, name: 1 }, { unique: true, name: "hospital_template_unique" });

export default mongoose.models.ScheduleTemplate || model("ScheduleTemplate", scheduleTemplateSchema);
