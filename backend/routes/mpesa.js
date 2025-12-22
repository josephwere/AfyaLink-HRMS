import express from "express";
import mpesa from "../payments/mpesa.js";

const router = express.Router();

router.post("/stkpush", async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const response = await mpesa.initiateSTK(phone, amount);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/callback", async (req, res) => {
  await mpesa.handleCallback(req.body);

  // Safaricom expects an immediate ACK
  res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
});

export default router;
