import mongoose from "mongoose";

const { Schema, model } = mongoose;

const familyAnchorApprovalSchema = new Schema(
  {
    anchorNationalIdNumber: { type: String, required: true, trim: true, index: true },
    anchorNationalIdCountry: { type: String, default: "KE", trim: true, index: true },
    anchorDisplayName: { type: String, trim: true, default: "" },
    anchorPhone: { type: String, trim: true, default: "" },
    anchorUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    approvalChannel: {
      type: String,
      enum: ["OTP", "ACCOUNT_LINK", "MANUAL"],
      default: "OTP",
    },
    otpRequestedAt: Date,
    otpVerifiedAt: Date,
    approvedAt: Date,
    approvedByUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedByPhone: { type: String, trim: true, default: "" },
    approvedByNationalId: { type: String, trim: true, default: "" },
    lastRequestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, default: "" },
    members: {
      type: [
        {
          patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
          relationship: { type: String, trim: true, default: "CHILD" },
          memberType: {
            type: String,
            enum: ["CHILD", "SPOUSE", "DEPENDENT", "OTHER"],
            default: "CHILD",
          },
          hospital: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
          linkedAt: { type: Date, default: Date.now },
          linkedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
          status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REMOVED"],
            default: "PENDING",
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

familyAnchorApprovalSchema.index(
  { anchorNationalIdNumber: 1, anchorNationalIdCountry: 1 },
  { unique: true }
);

export default model("FamilyAnchorApproval", familyAnchorApprovalSchema);
