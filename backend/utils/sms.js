import AfricasTalking from "africastalking";

let at = null;

function getAfricasTalking() {
  if (!at) {
    if (
      !process.env.AT_USERNAME ||
      !process.env.AT_API_KEY
    ) {
      throw new Error("Africa's Talking credentials are missing");
    }

    at = AfricasTalking({
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY,
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
