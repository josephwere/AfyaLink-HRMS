import dotenv from "dotenv";
import { sendEmail, getEmailProviderInfo } from "../utils/mailer.js";

dotenv.config();

const providerInfo = getEmailProviderInfo();
const to =
  process.env.BREVO_SMOKE_TO ||
  process.env.BREVO_SENDER_EMAIL ||
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM;

if (providerInfo.provider !== "brevo") {
  console.error(
    `[brevo-smoke] Brevo is not the active email provider. Current provider: ${providerInfo.provider}`
  );
  process.exit(1);
}

if (!to) {
  console.error(
    "[brevo-smoke] Set BREVO_SMOKE_TO or BREVO_SENDER_EMAIL before running the smoke script."
  );
  process.exit(1);
}

const sandbox =
  String(process.env.BREVO_SMOKE_SANDBOX || "1").trim() !== "0";

const result = await sendEmail({
  to,
  subject: `AfyaLink Brevo smoke ${new Date().toISOString()}`,
  html: `
    <div style="font-family:Arial,sans-serif;padding:24px">
      <h2>Brevo smoke test</h2>
      <p>This confirms AfyaLink can reach Brevo transactional email.</p>
      <p><strong>Sandbox mode:</strong> ${sandbox ? "enabled" : "disabled"}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    </div>
  `,
  text: `AfyaLink Brevo smoke test. Sandbox mode: ${sandbox ? "enabled" : "disabled"}.`,
  headers: sandbox ? { "X-Sib-Sandbox": "drop" } : undefined,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: result.provider,
      messageId: result.messageId || null,
      sandbox,
      to,
      response: result.response || null,
    },
    null,
    2
  )
);
