// notifications/africastalkingClient.js
import axios from "axios";

export async function sendSMS(to, message) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  const data = new URLSearchParams({
    username,
    to,
    message
  });

  const headers = {
    "apiKey": apiKey,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const res = await axios.post(
    "https://api.africastalking.com/version1/messaging",
    data,
    { headers }
  );

  return res.data;
}
