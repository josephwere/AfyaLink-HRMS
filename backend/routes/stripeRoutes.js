import express from "express";
import stripe from "../payments/stripe.js";

const router = express.Router();

router.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const result = await stripe.createPayment(amount, currency);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
