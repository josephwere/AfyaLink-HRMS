import { sendSMS as sendUnifiedSMS } from "../services/notificationService.js";

export const sendSMS = async ({ to, message }) => {
  return sendUnifiedSMS({ provider: "auto", to, message });
};
