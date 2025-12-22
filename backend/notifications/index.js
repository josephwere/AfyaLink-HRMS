import { sendTwilioSMS } from './twilioClient.js';
import { sendSMS as sendATSMS } from './africastalkingClient.js';

export const sendSMS = async ({ to, message }) => {
  const results = {};

  // Twilio
  try {
    results.twilio = await sendTwilioSMS({ to, message });
  } catch (err) {
    results.twilio = { error: err.message };
  }

  // Africa's Talking
  try {
    results.africastalking = await sendATSMS(to, message);
  } catch (err) {
    results.africastalking = { error: err.message };
  }

  return results;
};
