import mongoose from "mongoose";
const { Schema, model } = mongoose;

/* ======================================================
   EXTERNAL GOVERNMENT / POLICE ACCESS
====================================================== */
const externalAccessGrantSchema = new Schema(
  {
    agency: {
      type: String,
      required: true,
      index: true,
    },

    officerName: {
      type: String,
      required: true,
    },

    badgeNumber: {
      type: String,
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["GOVERNMENT_AUDITOR", "POLICE_OFFICER"],
      required: true,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },

    scope: {
      type: [String],
      enum: ["INCIDENTS", "ACCESS_LOGS", "VISITOR_LOGS"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
      minlength: 10,
    },

    tokenHash: {
      type: String,
      index: true,
      select: false,
    },

    ipAllowlist: [String],

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

export default model("ExternalAccessGrant", externalAccessGrantSchema);
