
import express from 'express';
import { sendSMS } from '../notifications/index.js';

const router = express.Router();

router.post('/sms', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to and message are required' });
  }

  try {
    const result = await sendSMS({ to, message });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
