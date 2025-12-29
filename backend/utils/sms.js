import AfricasTalking from "africastalking";

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

export const sendSMS = async (to, message) => {
  await at.SMS.send({
    to: [to],
    message,
  });
};
