// notifications/twilioClient.js
import twilio from "twilio";

export async function sendTwilioSMS({ to, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !from) {
    return {
      error: "Twilio credentials missing",
      status: "skipped"
    };
  }

  const client = twilio(accountSid, authToken);

  const res = await client.messages.create({
    body: message,
    from,
    to
  });

  return res;
}
