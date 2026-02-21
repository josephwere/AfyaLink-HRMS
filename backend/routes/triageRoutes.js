import express from "express";
import aiAdapter from "../services/aiAdapter.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

router.use(protect);

router.post("/classify", async (req, res) => {
  try {
    const { symptoms } = req.body;
    const out = await aiAdapter.diagnoseSymptoms(symptoms);

    const text = JSON.stringify(out || {}).toLowerCase();
    let priority = "low";
    if (text.includes("severe") || text.includes("critical")) priority = "high";
    else if (text.includes("moderate") || text.includes("urgent")) priority = "medium";

    res.json({ out, priority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }
    const out = await aiAdapter.transcribeAudioBase64(audioBase64);
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
