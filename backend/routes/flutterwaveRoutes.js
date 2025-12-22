import express from "express";
import flutter from "../payments/flutterwave.js";

const router = express.Router();

router.post("/pay", async (req, res) => {
  try {
    const { amount, phone, currency } = req.body;
    const response = await flutter.initiatePayment(amount, phone, currency);
    res.json({ ok: true, data: response });
  } catch (err) {
    console.error("Flutterwave error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/callback", async (req, res) => {
  try {
    const data = await flutter.handleCallback(req.body);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("Flutterwave callback error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
