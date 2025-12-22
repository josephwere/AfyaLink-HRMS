import express from 'express';
import { integrationDLQ, integrationQueue } from '../services/integrationQueue.js';
import Audit from '../models/Audit.js';
import auth from '../middleware/auth.js';



const router = express.Router();

// List DLQ items (latest 100)
router.get('/', auth, async (req,res)=>{
  try{
    const jobs = await integrationDLQ.getJobs(['waiting','active','completed','failed'], 0, 100);
    const out = jobs.map(j=>({ id: j.id, data: j.data, failedReason: j.failedReason, attemptsMade: j.attemptsMade || 0, timestamp: j.timestamp }));
    res.json(out);
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Retry DLQ item by id: move back to main queue
router.post('/:id/retry', auth, async (req,res)=>{
  try{
    const id = req.params.id;
    const job = await integrationDLQ.getJob(id);
    if(!job) return res.status(404).json({ error:'not found' });
    const data = job.data;
    await integrationQueue.add(data);
    await job.remove();
    await Audit.create({ actor: req.user?._id, action:'dlq_retry', details:{ jobId:id }, ip: req.ip });
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

export default router;
