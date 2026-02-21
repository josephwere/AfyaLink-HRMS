import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const FLW_SECRET = process.env.FLW_SECRET_KEY;
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET;

if (!FLW_SECRET) console.warn("⚠️ Missing FLW_SECRET_KEY");
if (!FLW_WEBHOOK_SECRET) console.warn("⚠️ Missing FLW_WEBHOOK_SECRET");

export default {
  /*
  |--------------------------------------------------------------------------
  | INITIATE PAYMENT (Frontend → Flutterwave Checkout Link)
  |--------------------------------------------------------------------------
  */
  initiatePayment: async (payload) => {
    try {
      const { amount, currency = "USD", email, phone, name } = payload;

      if (!amount || amount <= 0) {
        throw new Error("Invalid payment amount");
      }
      if (!email) {
        throw new Error("Customer email is required");
      }

      const txRef = "AfyaLink-" + Date.now(); // unique transaction reference

      const body = {
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: process.env.FLW_REDIRECT_URL,
        customer: {
          email,
          phonenumber: phone || "",
          name: name || "",
        },
        customizations: {
          title: "AfyaLink Payment",
          description: "Healthcare Service Payment",
        },
      };

      const { data } = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        body,
        {
          headers: {
            Authorization: `Bearer ${FLW_SECRET}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        status: "pending",
        paymentLink: data?.data?.link,
        txRef,
      };
    } catch (err) {
      console.error("❌ Flutterwave Payment Error:", err.response?.data || err);
      throw new Error("Failed to initiate Flutterwave payment");
    }
  },

  /*
  |--------------------------------------------------------------------------
  | WEBHOOK HANDLER (Server ← Flutterwave)
  |--------------------------------------------------------------------------
  | Flutterwave sends transaction verification events here:
  |   - charge.completed
  |   - charge.failed
  |   - checkout.completed
  |
  | We verify using SHA256 + secret:
  |    hash = sha256(JSON.stringify(body) + FLW_WEBHOOK_SECRET)
  |--------------------------------------------------------------------------
  */
  handleWebhook: async (body, headers) => {
    // Verify signature
    const signature = headers["verif-hash"];
    if (!signature) {
      console.error("❌ Missing Flutterwave signature");
      throw new Error("Missing signature");
    }

    // Local signature computation
    const expected = FLW_WEBHOOK_SECRET;
    if (signature !== expected) {
      console.error("❌ Invalid Flutterwave signature");
      throw new Error("Invalid signature");
    }

    const event = body.event;
    const data = body.data;

    console.log(`📨 Flutterwave Event: ${event}`);

    switch (event) {
      case "charge.completed":
      case "checkout.completed":
        if (data.status === "successful") {
          console.log("✅ Flutterwave Payment Successful:", data.tx_ref);

          // 👉 DB example
          // await PaymentModel.updateOne(
          //   { txRef: data.tx_ref },
          //   { status: "success", flwId: data.id }
          // );
        }
        break;

      case "charge.failed":
        console.log("❌ Flutterwave Payment Failed:", data.tx_ref);

        // 👉 DB example
        // await PaymentModel.updateOne(
        //   { txRef: data.tx_ref },
        //   { status: "failed" }
        // );
        break;

      default:
        console.log("ℹ️ Unhandled Flutterwave Event:", event);
    }

    return { received: true };
  },
};
