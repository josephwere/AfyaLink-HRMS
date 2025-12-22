import express from "express";
import {
  createStripeIntent,
  handleStripeWebhook,
  mpesaSTKPush,
  flutterwaveInit
} from "../controllers/paymentsController.js";

const router = express.Router();

// STRIPE
router.post("/stripe/intent", createStripeIntent);
router.post("/stripe/webhook", handleStripeWebhook);

// MPESA
router.post("/mpesa/stkpush", mpesaSTKPush);

// FLUTTERWAVE
router.post("/flutterwave/init", flutterwaveInit);

export default router;
