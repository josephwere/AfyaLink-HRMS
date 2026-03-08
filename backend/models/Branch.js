import mongoose from "mongoose";

const { Schema, model } = mongoose;

const branchSchema = new Schema(
  {
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    parentHospitalName: {
      type: String,
      trim: true,
      default: "",
    },
    verification: {
      status: {
        type: String,
        enum: ["UNVERIFIED", "REVIEW_REQUIRED", "VERIFIED", "REJECTED", "EXPIRED"],
        default: "UNVERIFIED",
        index: true,
      },
      registrationNumber: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      registryHospital: {
        type: Schema.Types.ObjectId,
        ref: "GovernmentHospitalRegistry",
        default: null,
      },
      approvalDate: Date,
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      expiresAt: Date,
      nextReverificationAt: Date,
      publicVisible: { type: Boolean, default: false, index: true },
      branchLicenseRequired: { type: Boolean, default: false },
      verificationMode: {
        type: String,
        enum: ["PARENT_LICENSE", "BRANCH_LICENSE"],
        default: "PARENT_LICENSE",
      },
      reviewNotes: { type: String, trim: true, default: "" },
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

branchSchema.index({ hospital: 1, name: 1 }, { unique: false });
branchSchema.index({ hospital: 1, "verification.status": 1, active: 1 });
branchSchema.index({ "verification.registrationNumber": 1 }, { sparse: true });

export default mongoose.models.Branch || model("Branch", branchSchema);
