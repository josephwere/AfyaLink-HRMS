import express from "express";
const router = express.Router();
import { protect } from "../middleware/authMiddleware.js";

import mpesa from "../payments/mpesa.js";
import stripe from "../payments/stripe.js";
import flutter from "../payments/flutterwave.js";
import paypal from "../payments/paypal.js";
import crypto from "../payments/crypto.js";
import Transaction from "../models/Transaction.js";
import Hospital from "../models/Hospital.js";
import { getPaymentSettingsDoc } from "../utils/paymentSettingsStore.js";

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
import shiftGuard from "../middleware/shiftGuard.js";

router.post(
  "/mpesa/stk",
  protect,
  shiftGuard,
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
  protect,
  shiftGuard,
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
  protect,
  shiftGuard,
  safe(async (req) => {
    return await flutter.initiatePayment(req.body);
  })
);

/**
 * ============================================================
 *             PAYMENT ROUTER (METHOD SELECTION)
 * ============================================================
 */
router.post(
  "/route",
  protect,
  shiftGuard,
  safe(async (req) => {
    const {
      method,
      amount,
      currency = "KES",
      phone,
      email,
      name,
      transactionId,
      hospitalId,
      metadata = {},
    } = req.body || {};

    if (!method) throw new Error("Payment method required");
    if (!amount) throw new Error("Amount is required");

    const normalized = String(method).toLowerCase();
    const meta = { ...metadata, transactionId };

    if (normalized === "mpesa") {
      if (!phone) throw new Error("Phone number required for M-Pesa");
      return await mpesa.initiateSTK(phone, amount);
    }

    if (normalized === "stripe") {
      return await stripe.createPaymentIntent(amount, currency, meta);
    }

    if (normalized === "flutterwave" || normalized === "airtel") {
      if (!email) throw new Error("Customer email required for Flutterwave");
      return await flutter.initiatePayment({
        amount,
        currency,
        email,
        phone,
        name,
      });
    }

      if (normalized === "paypal") {
      const result = await paypal.createOrder({
        amount,
        currency,
        email,
        name,
        metadata: meta,
      });
      await Transaction.create({
        provider: "paypal",
        reference: result?.orderId || result?.id || `paypal-${Date.now()}`,
        amount,
        currency,
        status: "pending",
        meta,
        hospital: hospitalId || req.user?.hospital || null,
      });
      return result;
    }

    if (normalized === "crypto") {
      const result = await crypto.createCharge({
        amount,
        currency,
        email,
        name,
        metadata: meta,
      });
      await Transaction.create({
        provider: "crypto",
        reference: result?.chargeId || result?.id || `crypto-${Date.now()}`,
        amount,
        currency,
        status: "pending",
        meta,
        hospital: hospitalId || req.user?.hospital || null,
      });
      return result;
    }

    if (normalized === "bank") {
      let details = null;
      if (hospitalId) {
        const hospital = await Hospital.findById(hospitalId).lean();
        const bankMethod = hospital?.patientPaymentMethods?.find(
          (row) => String(row.type || "").toLowerCase().includes("bank") && row.enabled !== false
        );
        if (bankMethod) {
          details = {
            bankName: bankMethod.label || bankMethod.bankName || "",
            accountName: bankMethod.accountName || "",
            accountNumber: bankMethod.accountNumber || "",
            paybill: bankMethod.paybill || "",
            tillNumber: bankMethod.tillNumber || "",
            instructions: bankMethod.instructions || "",
          };
        }
      }

      if (!details) {
        const settings = await getPaymentSettingsDoc({ lean: true, createIfMissing: false });
        const bank = settings?.bank || {};
        details = {
          bankName: bank.bankName || "",
          accountName: bank.accountName || "",
          accountNumber: "",
          branch: bank.branch || "",
          swiftCode: bank.swiftCode || "",
        };
      }

      const reference = `AFYA-BNK-${Date.now()}`;
      const lines = [
        "AfyaLink Bank Transfer Invoice",
        `Reference: ${reference}`,
        details.bankName ? `Bank: ${details.bankName}` : null,
        details.accountName ? `Account Name: ${details.accountName}` : null,
        details.accountNumber ? `Account No: ${details.accountNumber}` : null,
        details.branch ? `Branch: ${details.branch}` : null,
        details.swiftCode ? `Swift: ${details.swiftCode}` : null,
        `Amount: ${amount} ${currency}`,
        details.instructions ? `Instructions: ${details.instructions}` : null,
      ].filter(Boolean);

      return {
        status: "pending",
        method: "bank",
        details,
        reference,
        invoice: {
          reference,
          filename: `afyalink-bank-invoice-${reference}.txt`,
          text: lines.join("\n"),
        },
      };
    }

    throw new Error("Unsupported payment method");
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

/**
 * ============================================================
 *               PAYPAL WEBHOOK (SUCCESS/FAIL)
 * ============================================================
 */
router.post(
  "/paypal/webhook",
  express.json(),
  async (req, res) => {
    try {
      const result = await paypal.handleWebhook(req.body, req.headers);
      if (result?.reference) {
        await Transaction.findOneAndUpdate(
          { reference: result.reference },
          { status: result.status || "success", meta: result.meta || {} }
        );
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("❌ PayPal webhook error:", err.message);
      res.status(400).json({ ok: false });
    }
  }
);

/**
 * ============================================================
 *             CRYPTO WEBHOOK (COINBASE COMMERCE)
 * ============================================================
 */
router.post(
  "/crypto/webhook",
  express.json(),
  async (req, res) => {
    try {
      const result = await crypto.handleWebhook(req.body, req.headers);
      if (result?.reference) {
        await Transaction.findOneAndUpdate(
          { reference: result.reference },
          { status: result.status || "success", meta: result.meta || {} }
        );
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("❌ Crypto webhook error:", err.message);
      res.status(400).json({ ok: false });
    }
  }
);

export default router;
