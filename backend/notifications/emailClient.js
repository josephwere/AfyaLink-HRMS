// notifications/emailClient.js
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

const {
  SENDGRID_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM
} = process.env;

let transporter = null;
let useSendGrid = false;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  useSendGrid = true;
} else if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendEmail(to, subject, html, text) {
  if (useSendGrid) {
    const msg = { to, from: EMAIL_FROM || 'no-reply@example.com', subject, text, html };
    const resp = await sgMail.send(msg);
    return { ok: true, resp };
  }
  if (transporter) {
    const info = await transporter.sendMail({ from: EMAIL_FROM || 'no-reply@example.com', to, subject, text, html });
    return { ok: true, info };
  }
  console.warn('Email provider not configured - placeholder');
  return { ok: true, placeholder: true, to, subject };
}
