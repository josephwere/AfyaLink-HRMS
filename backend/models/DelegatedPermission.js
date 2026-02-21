import mongoose from "mongoose";

const { Schema, model } = mongoose;

const delegatedPermissionSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    grantee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    permissionKey: { type: String, required: true, trim: true, index: true }, // usually route path
    action: {
      type: String,
      enum: ["VIEW", "PERFORM", "MANAGE"],
      default: "VIEW",
      index: true,
    },
    effect: {
      type: String,
      enum: ["ALLOW", "DENY"],
      required: true,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

delegatedPermissionSchema.index(
  { grantee: 1, grantedBy: 1, permissionKey: 1, action: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

export default model("DelegatedPermission", delegatedPermissionSchema);
