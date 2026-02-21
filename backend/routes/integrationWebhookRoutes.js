import express from 'express';
import crypto from 'crypto';
import { integrationQueue } from '../services/integrationQueue.js';
import Connector from "../models/Connector.js";

const router = express.Router();

// Helper to verify signature header 'x-afya-signature' HMAC-SHA256 with connector secret
function verifySignature(secret, payload, sig){
  const h = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return h === sig;
}

// POST /api/integrations/webhook/:connectorId
router.post('/:connectorId', express.text({ type: '*/*' }), async (req, res) => {
  try{
    const connectorId = req.params.connectorId;
    const sig = req.headers['x-afya-signature'] || req.headers['x-signature'];
    const payload = req.body;
    const connector = await Connector.findOne({ _id: connectorId, isActive: true })
      .select("config")
      .lean();
    if (!connector) {
      return res.status(404).json({ error: "Connector not found or inactive" });
    }

    const secret =
      connector?.config?.webhookSecret ||
      process.env.WEBHOOK_SHARED_SECRET ||
      process.env.INTEGRATION_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Webhook secret is not configured" });
    }
    if (!sig) {
      return res.status(401).json({ error: "Missing webhook signature" });
    }
    if (!verifySignature(secret, payload, sig)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
    // Enqueue job for processing; worker will fetch connector details and verify secret
    await integrationQueue.add({ connectorId, payload, sig });
    res.json({ ok: true, queued: true });
  }catch(err){ console.error('webhook recv error', err); res.status(500).json({ error: err.message }); }
});

export default router;
