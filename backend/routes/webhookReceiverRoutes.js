import express from 'express';
import { receiveWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Generic receiver: POST /api/webhooks/:source
router.post('/:source', express.json({ limit: '2mb' }), receiveWebhook);

// Health check
router.get('/ping', (req,res) => res.json({ ok: true }));

export default router;
