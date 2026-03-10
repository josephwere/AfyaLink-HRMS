import mongoose from "mongoose";

const { Schema, model } = mongoose;

const bedSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    ward: { type: String, trim: true, required: true },
    number: { type: String, trim: true, required: true },
    occupied: { type: Boolean, default: false, index: true },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },
  },
  { timestamps: true }
);

bedSchema.index({ hospital: 1, ward: 1, number: 1 }, { unique: true });
bedSchema.index({ hospital: 1, occupied: 1, ward: 1 });

export default mongoose.models.Bed || model("Bed", bedSchema);
