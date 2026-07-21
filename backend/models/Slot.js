import mongoose from "mongoose";

const { Schema, model } = mongoose;

const slotSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMins: { type: Number, required: true, min: 5, max: 480 },
    status: {
      type: String,
      enum: ["AVAILABLE", "HELD", "BOOKED", "CHECKED_IN", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED", "RESCHEDULED"],
      default: "AVAILABLE",
      index: true,
    },
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
    template: { type: Schema.Types.ObjectId, ref: "ScheduleTemplate" },
    metadata: { type: Object, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

slotSchema.index({ doctor: 1, scheduledAt: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["AVAILABLE", "HELD", "BOOKED"] } } });
slotSchema.index({ hospital: 1, scheduledAt: 1, status: 1 });

export default mongoose.models.Slot || model("Slot", slotSchema);
