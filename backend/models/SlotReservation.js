import mongoose from "mongoose";

const { Schema, model } = mongoose;

const slotReservationSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMins: { type: Number, required: true, min: 5, max: 480 },
    status: {
      type: String,
      enum: ["HELD", "CONFIRMED", "EXPIRED", "CANCELLED"],
      default: "HELD",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

slotReservationSchema.index({ appointment: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["HELD", "CONFIRMED"] } } });
slotReservationSchema.index(
  { doctor: 1, scheduledAt: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["HELD", "CONFIRMED"] } }, name: "doctor_slot_reservation_unique" }
);

export default mongoose.models.SlotReservation || model("SlotReservation", slotReservationSchema);
