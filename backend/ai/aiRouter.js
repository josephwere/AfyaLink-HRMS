import express from 'express';
import * as ai from './aiService.js';
const router = express.Router();

router.post('/diagnose', async (req, res) => {
  const { symptoms } = req.body;
  const out = await ai.diagnose(symptoms);
  res.json(out);
});

router.post('/triage', async (req, res) => {
  const { symptoms } = req.body;
  const out = await ai.triage(symptoms);
  res.json(out);
});

router.post('/discharge', async (req, res) => {
  const data = req.body;
  const out = await ai.discharge(data);
  res.json(out);
});

router.post('/transcribe', async (req, res) => {
  const { audioBase64 } = req.body;
  const out = await ai.transcribe(audioBase64);
  res.json(out);
});

export default router;
