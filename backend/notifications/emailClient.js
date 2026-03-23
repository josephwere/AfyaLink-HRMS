import { sendEmail as sendMailThroughProvider, getEmailProviderInfo } from "../utils/mailer.js";

export async function sendEmail(to, subject, html, text) {
  const result = await sendMailThroughProvider({ to, subject, html, text });
  return { ok: true, ...result };
}

export function getEmailClientStatus() {
  return getEmailProviderInfo();
}
