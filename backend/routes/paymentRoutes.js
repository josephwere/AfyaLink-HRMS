import express from "express";
const router = express.Router();

import mpesa from "../payments/mpesa.js";
import stripe from "../payments/stripe.js";
import flutter from "../payments/flutterwave.js";

/**
 * ------------------------------------------------------------
 *  Helper Wrapper: Catches errors and responds cleanly
 * ------------------------------------------------------------
 */
const safe = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("❌ PAYMENT ERROR:", err);
    res.status(500).json({
      ok: false,
      error: err.message || "Payment processing failed",
    });
  }
};

/**
 * ============================================================
 *                  M-PESA - STK PUSH
 * ============================================================
 */
router.post(
  "/mpesa/stk",
  safe(async (req) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) throw new Error("Phone & amount required");

    return await mpesa.initiateSTK(phone, amount);
  })
);

// Safaricom Callback URL (must match .env)
router.post(
  "/mpesa/callback",
  safe(async (req) => {
    return await mpesa.handleCallback(req.body);
  })
);

/**
 * ============================================================
 *                  STRIPE GLOBAL PAYMENTS
 * ============================================================
 */
router.post(
  "/stripe/create-intent",
  safe(async (req) => {
    const { amount, currency = "usd", metadata = {} } = req.body;

    if (!amount) throw new Error("Amount is required");

    return await stripe.createPaymentIntent(amount, currency, metadata);
  })
);

// Stripe webhook (server → Stripe event notifications)
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const response = await stripe.handleWebhook(req, res);
      res.json(response);
    } catch (err) {
      console.error("❌ Stripe Webhook Error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

/**
 * ============================================================
 *         FLUTTERWAVE (Africa, Mobile Money, Cards)
 * ============================================================
 */
router.post(
  "/flutter/init",
  safe(async (req) => {
    return await flutter.initiatePayment(req.body);
  })
);

// Flutterwave webhook
router.post(
  "/flutter/webhook",
  express.json(),
  async (req, res) => {
    try {
      const response = await flutter.handleWebhook(req.body, req.headers);
      res.status(200).json(response);
    } catch (err) {
      console.error("❌ Flutterwave Webhook Error:", err);
      res.status(400).json({ ok: false });
    }
  }
);

export default router;
