import User from "../models/User.js";
import { sendEmail } from "../utils/mailer.js";
import AuditLog from "../models/AuditLog.js";
import { sendSMS } from "../utils/sms.js";

const WINDOWS = [
  { tag: "14d", hours: 14 * 24, label: "14 days" },
  { tag: "3d", hours: 3 * 24, label: "3 days" },
  { tag: "2h", hours: 2, label: "2 hours" },
];

function pickReminderWindow(deadline) {
  const now = Date.now();
  const msLeft = new Date(deadline).getTime() - now;
  if (msLeft <= 0) return null;

  const hoursLeft = msLeft / (1000 * 60 * 60);

  for (const window of WINDOWS) {
    if (hoursLeft <= window.hours) return window;
  }
  return null;
}

export const sendVerificationReminders = async () => {
  try {
    const users = await User.find({
      emailVerified: false,
      verificationDeadline: { $exists: true, $gt: new Date() },
    });

    for (const user of users) {
      const window = pickReminderWindow(user.verificationDeadline);
      if (!window) continue;

      const sent = user.verificationRemindersSent || [];
      if (sent.includes(window.tag)) continue;

      const msg = `AfyaLink: Verify your account. It will be deleted in ${window.label}.`;

      try {
        await sendEmail({
          to: user.email,
          subject: "Verify your AfyaLink account",
          html: `
            <p>Your account will be deleted in ${window.label}.</p>
            <p>Please verify your email to keep your profile.</p>
          `,
        });
      } catch (err) {
        console.error(`❌ Email reminder failed for ${user.email}:`, err.message);
      }

      if (user.phone) {
        try {
          await sendSMS(user.phone, msg);
        } catch (err) {
          console.error(`❌ SMS reminder failed for ${user.email}:`, err.message);
        }
      }

      user.verificationRemindersSent = [...sent, window.tag];
      await user.save();

      await AuditLog.create({
        actorId: user._id,
        actorRole: user.role || "PATIENT",
        action: "VERIFICATION_REMINDER_SENT",
        resource: "User",
        resourceId: user._id,
        metadata: { reminder: window.tag },
      });
    }
  } catch (err) {
    console.error("❌ Verification reminders failed:", err);
  }
};

