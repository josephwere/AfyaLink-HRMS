import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // MUST be false for 587
  auth: {
    user: process.env.SMTP_USER, // your Gmail address
    pass: process.env.SMTP_PASS, // 16-char App Password
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"AfyaLink HRMS" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};
