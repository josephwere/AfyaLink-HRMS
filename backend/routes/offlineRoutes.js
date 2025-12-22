import express from 'express';
import { integrationQueue } from '../services/integrationQueue.js';
import Audit from '../models/Audit.js';
import auth from '../middleware/auth.js';


const router = express.Router();

// Upload cached events from offline clients - accept an array of { connectorId, payload, sig }
router.post('/upload', auth, async (req,res)=>{
  try{
    const items = req.body.items || [];
    for(const it of items){
      await integrationQueue.add(it);
    }
    await Audit.create({ actor: req.user?._id, action:'offline_upload', details:{ count: items.length }, ip: req.ip });
    res.json({ ok:true, queued: items.length });
  }catch(err){ console.error('offline upload', err); res.status(500).json({ error: err.message }); }
});

// Check sync status - simple placeholder
router.get('/status', auth, async (req,res)=>{
  // return queue counts
  try{
    const counts = { integrationQueue: await integrationQueue.count(), dlq: await (await import('../services/integrationQueue.js')).integrationDLQ.count() };
    res.json({ ok:true, counts });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

export default router;
