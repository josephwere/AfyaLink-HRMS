import AfricasTalking from "africastalking";

let at = null;

function getAfricasTalking() {
  const username = process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY;
  if (!at) {
    if (
      !username ||
      !apiKey
    ) {
      throw new Error("Africa's Talking credentials are missing");
    }

    at = AfricasTalking({
      username,
      apiKey,
    });
  }

  return at;
}

export const sendSMS = async (to, message) => {
  const sms = getAfricasTalking().SMS;

  await sms.send({
    to: [to],
    message,
  });
};
