import express from 'express';
import aiAdapter from '../services/aiAdapter.js';
const router = express.Router();

router.post('/classify', async (req,res)=>{
  try{
    const { symptoms } = req.body;
    const out = await aiAdapter.diagnoseSymptoms(symptoms);
    // basic triage mapping: if mentions 'severe' mark high priority (placeholder)
    let priority = 'low';
    if(typeof out === 'object' && out.text && out.text.toLowerCase().includes('severe')) priority='high';
    res.json({ out, priority });
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
});

export default router;
