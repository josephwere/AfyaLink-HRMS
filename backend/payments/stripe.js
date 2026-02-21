import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

/*
|--------------------------------------------------------------------------
| STRIPE INITIALIZATION
|--------------------------------------------------------------------------
*/
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ Missing STRIPE_SECRET_KEY in environment!");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/*
|--------------------------------------------------------------------------
| CREATE PAYMENT INTENT (Frontend → Server)
|--------------------------------------------------------------------------
*/
async function createPaymentIntent(amount, currency = "usd", metadata = {}) {
  try {
    if (!amount || amount <= 0) {
      throw new Error("Invalid payment amount.");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // USD → cents
      currency,
      metadata: {
        ...metadata,
        system: "AfyaLink Global Payment",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      status: "created",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
    };
  } catch (err) {
    console.error("❌ Stripe PaymentIntent Error:", err);
    throw new Error(err.message || "Failed to create Stripe PaymentIntent");
  }
}

/*
|--------------------------------------------------------------------------
| STRIPE WEBHOOK HANDLER (Server → Stripe)
|--------------------------------------------------------------------------
| Stripe sends all payment update events here:
|  - payment_intent.succeeded
|  - payment_intent.payment_failed
|  - payment_intent.canceled
|  - charge.refunded
|
| NOTE: app.js MUST use express.raw() for this route!
|--------------------------------------------------------------------------
*/
async function handleWebhook(req, res) {
  let event;
  const sig = req.headers["stripe-signature"];

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe Webhook Signature Error:", err.message);
    throw new Error("Stripe webhook signature verification failed");
  }

  const data = event.data.object;

  switch (event.type) {
    case "payment_intent.succeeded":
      console.log("✅ Payment succeeded:", data.id);

      // 👉 Store in DB (example)
      // await PaymentModel.updateOne(
      //   { paymentIntentId: data.id },
      //   { status: "success" }
      // );

      break;

    case "payment_intent.payment_failed":
      console.log("❌ Payment failed:", data.id);

      // 👉 Store in DB (example)
      // await PaymentModel.updateOne(
      //   { paymentIntentId: data.id },
      //   { status: "failed" }
      // );

      break;

    default:
      console.log(`ℹ️ Stripe Event Received: ${event.type}`);
  }

  return { received: true };
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/
export default {
  createPaymentIntent,
  handleWebhook,
};
