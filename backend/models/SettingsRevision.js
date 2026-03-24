import mongoose from "mongoose";

const { Schema, model } = mongoose;

const settingsRevisionSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["SYSTEM", "HOSPITAL"],
      required: true,
      index: true,
    },
    scopeId: {
      type: String,
      required: true,
      index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorRole: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      default: "manual-save",
      trim: true,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

settingsRevisionSchema.index({ scope: 1, scopeId: 1, createdAt: -1 });

export default model("SettingsRevision", settingsRevisionSchema);
