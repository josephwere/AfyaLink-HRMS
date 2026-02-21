import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/*
|--------------------------------------------------------------------------
| ENV SETUP
|--------------------------------------------------------------------------
*/
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_SHORTCODE;
const passkey = process.env.MPESA_PASSKEY;
const callbackURL = process.env.MPESA_CALLBACK_URL;

/*
|--------------------------------------------------------------------------
| ENV VALIDATION
|--------------------------------------------------------------------------
*/
function validateEnv() {
  const missing = [];

  if (!consumerKey) missing.push("MPESA_CONSUMER_KEY");
  if (!consumerSecret) missing.push("MPESA_CONSUMER_SECRET");
  if (!shortcode) missing.push("MPESA_SHORTCODE");
  if (!passkey) missing.push("MPESA_PASSKEY");
  if (!callbackURL) missing.push("MPESA_CALLBACK_URL");

  if (missing.length > 0) {
    console.warn("⚠️ Missing M-Pesa ENV Vars:", missing);
  }
}

validateEnv();

/*
|--------------------------------------------------------------------------
| MPESA BASE URL (AUTO SANDBOX / PRODUCTION)
|--------------------------------------------------------------------------
*/
const MPESA_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

/*
|--------------------------------------------------------------------------
| ACCESS TOKEN
|--------------------------------------------------------------------------
*/
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const { data } = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    return data.access_token;
  } catch (err) {
    console.error("❌ Error fetching M-Pesa token:", err.response?.data || err);
    throw new Error("Failed to obtain M-Pesa access token");
  }
}

/*
|--------------------------------------------------------------------------
| PHONE NORMALIZER (2547XXXXXXXX)
|--------------------------------------------------------------------------
*/
function normalizePhone(phone) {
  phone = phone.toString().trim();

  if (phone.startsWith("0")) {
    return "254" + phone.substring(1);
  }

  if (phone.startsWith("+")) {
    return phone.substring(1);
  }

  return phone; // assume already correct
}

/*
|--------------------------------------------------------------------------
| TIMESTAMP (YYYYMMDDHHMMSS)
|--------------------------------------------------------------------------
*/
function getTimestamp() {
  const date = new Date();
  return date
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
}

/*
|--------------------------------------------------------------------------
| STK PUSH
|--------------------------------------------------------------------------
*/
async function initiateSTK(phone, amount) {
  try {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
    const normalizedPhone = normalizePhone(phone);

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: normalizedPhone,
      PartyB: shortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: callbackURL,
      AccountReference: "AfyaLink",
      TransactionDesc: "Payment for Services"
    };

    const { data } = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return {
      status: "submitted",
      requestId: data.MerchantRequestID,
      checkoutId: data.CheckoutRequestID,
      raw: data
    };
  } catch (err) {
    console.error("❌ STK ERROR:", err.response?.data || err);
    throw new Error(
      err.response?.data?.errorMessage || "Failed to initiate M-Pesa STK push"
    );
  }
}

/*
|--------------------------------------------------------------------------
| CALLBACK HANDLER
|--------------------------------------------------------------------------
*/
async function handleCallback(callbackData) {
  console.log("📩 M-Pesa Callback Received:\n", JSON.stringify(callbackData, null, 2));

  const result = callbackData?.Body?.stkCallback;

  const paymentInfo = {
    merchantRequestId: result?.MerchantRequestID,
    checkoutRequestId: result?.CheckoutRequestID,
    resultCode: result?.ResultCode,
    resultDesc: result?.ResultDesc,
    amount: result?.CallbackMetadata?.Item?.find(e => e.Name === "Amount")?.Value,
    phone:
      result?.CallbackMetadata?.Item?.find(e => e.Name === "PhoneNumber")?.Value ||
      null
  };

  // 🔥 Optional DB Save Spot
  // await PaymentModel.create(paymentInfo);

  return {
    received: true,
    ...paymentInfo
  };
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/
export default {
  initiateSTK,
  handleCallback
};
