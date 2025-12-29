import User from "../models/User.js";
import { sendEmail } from "../utils/mailer.js";
import AuditLog from "../models/AuditLog.js";
import { sendSMS } from "../utils/sms.js";

if (user.phone) {
  await sendSMS(
    user.phone,
    `AfyaLink: Verify your account. It will be deleted in ${tag}.`
  );
}

...

await sendEmail({
  to: user.email,
  subject: "Verify your AfyaLink account",
  html: `
    <p>Your account will be deleted in ${tag}.</p>
    <p>Please verify your email to keep your profile.</p>
  `,
});

user.verificationRemindersSent.push(tag);
await user.save();

await AuditLog.create({
  actorId: user._id,
  actorRole: user.role || "user",
  action: "VERIFICATION_REMINDER_SENT",
  resource: "User",
  resourceId: user._id,
  metadata: { reminder: tag },
});
