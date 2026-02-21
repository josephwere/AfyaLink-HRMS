import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
