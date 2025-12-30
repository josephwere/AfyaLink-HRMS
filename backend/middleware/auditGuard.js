import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";

/**
 * auditGuard
 * @param {Object} options
 * @param {string[]} options.roles - allowed roles
 * @param {string} options.feature - hospital feature toggle key
 * @param {string} options.action - audit action name
 * @param {string} options.resource - audited resource name
 */
export const auditGuard =
  ({ roles = [], feature, action, resource }) =>
  async (req, res, next) => {
    const user = req.user;

    let success = false;
    let error = null;

    try {
      if (!user) {
        error = "Unauthenticated";
        return res.status(401).json({ message: error });
      }

      /* ================= ROLE CHECK ================= */
      if (roles.length && !roles.includes(user.role)) {
        error = "Forbidden: role";
        return res.status(403).json({ message: error });
      }

      /* ================= FEATURE TOGGLE ================= */
      if (feature && user.hospital) {
        const hospital = await Hospital.findById(user.hospital)
          .select("features")
          .lean();

        if (!hospital?.features?.[feature]) {
          error = "Feature disabled for hospital";
          return res.status(403).json({ message: error });
        }
      }

      success = true;
      next();
    } catch (err) {
      error = err.message;
      res.status(500).json({ message: "Access check failed" });
    } finally {
      /* ================= AUDIT LOG ================= */
      try {
        await AuditLog.create({
          actorId: user?._id,
          actorRole: user?.role,
          action,
          resource,
          hospital: user?.hospital,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          success,
          error,
        });
      } catch (logErr) {
        // audit logging must NEVER block request
        console.error("Audit log failed:", logErr.message);
      }
    }
  };
