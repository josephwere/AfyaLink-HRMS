import crypto from "crypto";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "./mailer.js";
import { appendComplianceLedger } from "./complianceLedger.js";

function emailTemplate(title, body) {
  return `
    <div style="font-family:Arial;background:#f4f6f8;padding:30px">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:30px">
        <h2 style="color:#0a7cff">${title}</h2>
        <div style="color:#333;font-size:15px">${body}</div>
        <hr />
        <p style="font-size:12px;color:#777">
          AfyaLink HRMS • Secure Healthcare Systems
        </p>
      </div>
    </div>
  `;
}

export function resolveFrontendBase(req) {
  return process.env.FRONTEND_URL || req.headers.origin || `${req.protocol}://${req.get("host")}`;
}

export async function issuePasswordResetLink({
  user,
  frontendBase,
  actorId = null,
  actorRole = null,
  invite = false,
  metadata = {},
}) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.resetPasswordToken = hashed;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  user.resetPasswordRequestedAt = new Date();
  await user.save();

  const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;
  const title = invite ? "Set your AfyaLink password" : "Reset your AfyaLink password";
  const intro = invite
    ? "<p>Your AfyaLink account is ready. Use the secure link below to set your password and activate your workspace.</p>"
    : "<p>Click the link below to reset your password. This link expires in 1 hour.</p>";

  await sendEmail({
    to: user.email,
    subject: title,
    html: emailTemplate(
      title,
      `${intro}
       <p><a href="${resetLink}">${invite ? "Set Password" : "Reset Password"}</a></p>`
    ),
  });

  const auditMetadata = {
    ...metadata,
    invite,
    frontendBase,
    expiresAt: user.resetPasswordExpires,
  };

  await AuditLog.create({
    actorId: actorId || user._id,
    actorRole: actorRole || user.role,
    action: "PASSWORD_RESET_REQUESTED",
    resource: "User",
    resourceId: user._id,
    metadata: auditMetadata,
  });
  await appendComplianceLedger({
    actorId: actorId || user._id,
    actorRole: actorRole || user.role,
    action: "PASSWORD_RESET_REQUESTED",
    resource: "User",
    resourceId: user._id,
    hospital: user.hospital || null,
  });

  return {
    resetLink,
    expiresAt: user.resetPasswordExpires,
    requestedAt: user.resetPasswordRequestedAt,
    invite,
  };
}
