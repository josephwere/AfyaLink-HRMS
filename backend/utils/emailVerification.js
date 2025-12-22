import jwt from "jsonwebtoken";
import { sendEmail } from "../services/emailService.js";

export function generateEmailToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export async function sendVerificationEmail(user) {
  const token = generateEmailToken(user._id);

  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your AfyaLink account",
    html: `
      <h2>Welcome to AfyaLink</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
