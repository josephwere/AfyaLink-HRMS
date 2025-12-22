import express from 'express';
import { integrationDLQ, integrationQueue } from '../services/integrationQueue.js';
import Audit from '../models/Audit.js';
import auth from '../middleware/auth.js';


const router = express.Router();

// GET DLQ items
router.get('/', auth, async (req,res)=> {
  const jobs = await integrationDLQ.getJobs(['waiting','failed','delayed'], 0, 200);
  const out = jobs.map(j=>({ id:j.id, data:j.data, failedReason:j.failedReason, attemptsMade:j.attemptsMade, timestamp:j.timestamp }));
  res.json(out);
});

// GET single job
router.get('/:id', auth, async (req,res)=> {
  const job = await integrationDLQ.getJob(req.params.id);
  if(!job) return res.status(404).json({ error:'not found' });
  res.json({ id: job.id, data: job.data, failedReason: job.failedReason, attemptsMade: job.attemptsMade, timestamp: job.timestamp });
});

// PUT edit job data
router.put('/:id', auth, async (req,res)=> {
  const job = await integrationDLQ.getJob(req.params.id);
  if(!job) return res.status(404).json({ error:'not found' });
  // replace data with new payload
  const newData = req.body.data;
  await job.update({ data: newData });
  await Audit.create({ actor: req.user?._id, action:'dlq_edit', details:{ jobId: job.id } , ip: req.ip });
  res.json({ ok:true });
});

// Retry edited job: move to main queue
router.post('/:id/retry', auth, async (req,res)=> {
  const job = await integrationDLQ.getJob(req.params.id);
  if(!job) return res.status(404).json({ error:'not found' });
  const data = job.data;
  await integrationQueue.add(data);
  await job.remove();
  await Audit.create({ actor: req.user?._id, action:'dlq_retry_manual', details:{ jobId: job.id } , ip: req.ip });
  res.json({ ok:true });
});

export default router;
