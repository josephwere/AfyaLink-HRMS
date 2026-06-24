// notifications/twilioClient.js
import { sendSMS } from "../services/notificationService.js";

export async function sendTwilioSMS({ to, message }) {
  return sendSMS({ provider: "twilio", to, message });
}
