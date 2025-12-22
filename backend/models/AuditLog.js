import mongoose from "mongoose";

const { Schema, model } = mongoose;

/* ======================================================
   AUDIT LOG — COMPLIANCE GRADE
====================================================== */
const auditLogSchema = new Schema(
  {
    /* ================= WHO ================= */
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    actorRole: {
      type: String,
      index: true,
    },

    /* ================= WHAT ================= */
    action: {
      type: String,
      required: true,
      index: true,
    },

    resource: {
      type: String,
      index: true,
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    /* ================= STATE ================= */
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,

    /* ================= TENANCY ================= */
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    /* ================= CONTEXT ================= */
    ip: String,
    userAgent: String,

    /* ================= RESULT ================= */
    success: {
      type: Boolean,
      default: true,
      index: true,
    },

    error: String,
  },
  {
    timestamps: true,
  }
);

/* ======================================================
   COMPOUND INDEXES (SCALE & FORENSICS)
====================================================== */
auditLogSchema.index({ hospital: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

/* ======================================================
   EXPORT (HOT-RELOAD SAFE)
====================================================== */
export default mongoose.models.AuditLog ||
  model("AuditLog", auditLogSchema);
