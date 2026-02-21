import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   VISITOR — NON USER PERSON
====================================================== */
const visitorSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      index: true,
    },

    idNumber: {
      type: String,
      index: true,
    },

    blacklisted: {
      type: Boolean,
      default: false,
      index: true,
    },

    blacklistReason: String,

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.models.Visitor ||
  model("Visitor", visitorSchema);
