import User from "../models/User.js";
import { sendEmail } from "../utils/mailer.js";

export const sendVerificationReminders = async () => {
  const now = new Date();

  const users = await User.find({
    emailVerified: false,
    verificationDeadline: { $gt: now },
  });

  for (const user of users) {
    const msLeft = user.verificationDeadline - now;
    const hoursLeft = msLeft / (1000 * 60 * 60);

    let tag = null;

    if (hoursLeft <= 2) tag = "2h";
    else if (hoursLeft <= 72) tag = "3d";
    else if (hoursLeft <= 336) tag = "14d";

    if (!tag || user.verificationRemindersSent.includes(tag)) continue;

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
  }
};
