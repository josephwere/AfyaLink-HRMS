import AuditLog from "../models/AuditLog.js";

/* ======================================================
   AUDIT MIDDLEWARE (POST-RESPONSE, SAFE)
====================================================== */
export const audit = (action, resource) => {
  return (req, res, next) => {
    // Snapshot before state (set by controller if needed)
    const before = req.resource || null;

    res.on("finish", async () => {
      try {
        await AuditLog.create({
          actorId: req.user?.id || null,
          actorRole: req.user?.role || null,

          action,
          resource,
          resourceId: req.params?.id || null,

          before,
          after: res.locals?.after || null,

          hospital: req.user?.hospital || null,

          ip: req.ip,
          userAgent: req.headers["user-agent"],

          success: res.statusCode < 400,
          statusCode: res.statusCode,
        });
      } catch (err) {
        // Never break the app because of audit failure
        console.error("❌ Audit log failed:", err.message);
      }
    });

    next();
  };
};
