import express from "express";
import mpesa from "../payments/mpesa.js";

const router = express.Router();

// Initiate STK push
router.post("/stkpush", async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const response = await mpesa.initiateSTK(phone, amount);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// M-Pesa callback (must be publicly accessible)
router.post("/callback", async (req, res) => {
  await mpesa.handleCallback(req.body);

  // Must return ACK immediately or Safaricom retries
  res.json({
    ResultCode: 0,
    ResultDesc: "Callback received successfully"
  });
});

export default router;
