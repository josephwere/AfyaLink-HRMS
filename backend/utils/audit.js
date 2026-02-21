import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import { detectAnomaly } from "./anomaly.js";
import { sendEmail } from "./mailer.js";// existing or stub
import { sendSMS } from "./sms.js";            // stub for now

/* ======================================================
   NON-BLOCKING EMERGENCY ALERTS
====================================================== */
const notifyEmergency = async ({ req, metadata }) => {
  try {
    const hospital = await Hospital.findById(req.user.hospital).lean();
    if (!hospital) return;

    // 🔔 Notify SUPER ADMINS ONLY
    const superAdmins = await User.find({
      role: "SUPER_ADMIN",
      active: true,
    }).select("email phone name");

    const message = `
🚨 EMERGENCY ACCESS ACTIVATED

Hospital: ${hospital.name}
Activated by: ${req.user.name} (${req.user.role})
Reason: ${metadata?.reason || "Not specified"}
Expires: ${metadata?.expiresAt}

Time: ${new Date().toISOString()}
`;

    // Email (non-blocking)
    for (const admin of superAdmins) {
      if (admin.email) {
        sendEmail({
          to: admin.email,
          subject: "🚨 Emergency Access Activated",
          text: message,
        }).catch(() => {});
      }

      // SMS (stub — ready for Africa’s Talking / Twilio)
      if (admin.phone) {
        sendSMS({
          to: admin.phone,
          message,
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Alerts must NEVER break audit or app
    console.error("EMERGENCY ALERT FAILED:", err.message);
  }
};

/* ======================================================
   AUDIT LOGGER (CORE)
====================================================== */
export const audit = async ({
  req,
  action,
  resource,
  resourceId,
  metadata = {},
  before,
  after,
  success = true,
  error,
}) => {
  try {
    if (!req?.user) return;

    const anomaly = detectAnomaly({
      action,
      role: req.user.role,
    });

    await AuditLog.create({
      /* ================= WHO ================= */
      actorId: req.user._id,
      actorRole: req.user.role,

      /* ================= WHAT ================= */
      action,
      resource,
      resourceId,

      /* ================= STATE ================= */
      before,
      after,

      /* ================= TENANCY ================= */
      hospital: req.user.hospital,

      /* ================= CONTEXT ================= */
      ip: req.ip,
      userAgent: req.headers["user-agent"],

      /* ================= RESULT ================= */
      success,
      error,

      /* ================= METADATA ================= */
      metadata: {
        ...metadata,
        anomaly,
      },
    });

    /* ======================================================
       🚨 EMERGENCY BREAK-GLASS ALERT
    ====================================================== */
    if (action === "BREAK_GLASS_ACTIVATED" && success) {
      notifyEmergency({ req, metadata });
    }
  } catch (err) {
    // Audit must NEVER break the app
    console.error("AUDIT FAILED:", err.message);
  }
};
