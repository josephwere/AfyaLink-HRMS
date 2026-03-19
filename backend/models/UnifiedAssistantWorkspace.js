import mongoose from "mongoose";

const { Schema, model } = mongoose;

const unifiedAssistantWorkspaceSchema = new Schema(
  {
    scopeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    operatingMode: {
      type: String,
      enum: ["ASSIST", "AUTO", "TAKEOVER"],
      default: "ASSIST",
      index: true,
    },
    humanAvailability: {
      status: {
        type: String,
        enum: ["AVAILABLE", "BUSY", "AWAY", "OFFLINE"],
        default: "AVAILABLE",
      },
      note: {
        type: String,
        trim: true,
        default: "",
      },
      updatedAt: Date,
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    handoffPolicy: {
      autoReplyWhenUnavailable: {
        type: Boolean,
        default: true,
      },
      autoEscalateCritical: {
        type: Boolean,
        default: true,
      },
      requireReasonForTakeover: {
        type: Boolean,
        default: false,
      },
    },
    takeover: {
      active: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      entityKind: {
        type: String,
        trim: true,
        default: "",
      },
      entityId: {
        type: String,
        trim: true,
        default: "",
      },
      startedAt: Date,
      startedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    lastAutoHandledAt: Date,
    lastHumanHandledAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

unifiedAssistantWorkspaceSchema.index({ hospital: 1, updatedAt: -1 });
unifiedAssistantWorkspaceSchema.index({ operatingMode: 1, updatedAt: -1 });

export default mongoose.models.UnifiedAssistantWorkspace ||
  model("UnifiedAssistantWorkspace", unifiedAssistantWorkspaceSchema);
