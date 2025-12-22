import express from 'express';
import crypto from 'crypto';
import { integrationQueue } from '../services/integrationQueue.js';

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
    // Enqueue job for processing; worker will fetch connector details and verify secret
    await integrationQueue.add({ connectorId, payload, sig });
    res.json({ ok: true, queued: true });
  }catch(err){ console.error('webhook recv error', err); res.status(500).json({ error: err.message }); }
});

export default router;
