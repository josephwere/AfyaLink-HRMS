import mongoose from "mongoose";
import Hospital from "./Hospital.js"; // To check ISO compliance

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

    /* ================= METADATA ================= */
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ======================================================
   🔒 IMMUTABILITY — AUDIT-SAFE (NO EDIT / NO DELETE)
   Enforced only when hospital.isoCompliance.enabled = true
====================================================== */
async function isoCheck(next, doc, query) {
  try {
    const hospitalId = doc?.hospital || query?._update?.hospital || query?.hospital;
    if (!hospitalId) return next();

    const hospital = await Hospital.findById(hospitalId).lean();
    if (hospital?.isoCompliance?.enabled) {
      throw new Error("Audit logs are immutable under ISO compliance");
    }

    next();
  } catch (err) {
    next(err);
  }
}

// Apply hooks for ISO protection
auditLogSchema.pre("updateOne", function (next) {
  return isoCheck(next, this.getFilter(), this.getUpdate());
});
auditLogSchema.pre("updateMany", function (next) {
  return isoCheck(next, this.getFilter(), this.getUpdate());
});
auditLogSchema.pre("findOneAndUpdate", function (next) {
  return isoCheck(next, this.getFilter(), this.getUpdate());
});
auditLogSchema.pre("deleteOne", function (next) {
  return isoCheck(next, this.getFilter());
});
auditLogSchema.pre("deleteMany", function (next) {
  return isoCheck(next, this.getFilter());
});
auditLogSchema.pre("findOneAndDelete", function (next) {
  return isoCheck(next, this.getFilter());
});

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
