import { integrationDLQ, integrationQueue } from '../services/integrationQueue.js';
import Audit from '../models/Audit.js';

// List DLQ items
export async function listDLQ(req,res){
  const jobs = await integrationDLQ.getJobs(['waiting','active','completed','failed'], 0, 200);
  const out = jobs.map(j=>({ id: j.id, data: j.data, failedReason: j.failedReason, attemptsMade: j.attemptsMade || 0, timestamp: j.timestamp }));
  res.json(out);
}

// Get single DLQ item
export async function getDLQItem(req,res){
  const id = req.params.id;
  const job = await integrationDLQ.getJob(id);
  if(!job) return res.status(404).json({ error:'not found' });
  res.json({ id: job.id, data: job.data, failedReason: job.failedReason, attemptsMade: job.attemptsMade, stack: job.stacktrace });
}

// Update payload (edit) and retry
export async function editAndRetry(req,res){
  try{
    const id = req.params.id;
    const { newData } = req.body;
    const job = await integrationDLQ.getJob(id);
    if(!job) return res.status(404).json({ error:'not found' });
    // add new job to main queue with modified payload
    await integrationQueue.add(newData);
    await job.remove();
    await Audit.create({ actor: req.user?._id, action:'dlq_edit_retry', details:{ jobId:id }, ip: req.ip });
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
}

// Update retry policy for a connector
import Connector from '../models/Connector.js';
export async function updateRetryPolicy(req,res){
  try{
    const id = req.params.connectorId;
    const { attempts, backoffDelay, backoffType } = req.body;
    const c = await Connector.findById(id);
    if(!c) return res.status(404).json({ error:'connector not found' });
    c.retryPolicy = { attempts: attempts||c.retryPolicy?.attempts||5, backoffDelay: backoffDelay||c.retryPolicy?.backoffDelay||1000, backoffType: backoffType||c.retryPolicy?.backoffType||'exponential' };
    await c.save();
    await Audit.create({ actor: req.user?._id, action:'connector_retry_policy_updated', details:{ connector:id, retryPolicy:c.retryPolicy }, ip: req.ip });
    res.json({ ok:true, retryPolicy: c.retryPolicy });
  }catch(err){ res.status(500).json({ error: err.message }); }
}
