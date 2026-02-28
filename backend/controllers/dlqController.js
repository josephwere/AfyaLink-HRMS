import Audit from "../models/Audit.js";
import Connector from "../models/Connector.js";
import { getDlqJobById, getDlqJobs, replayDlqJob } from "../services/dlqReplayService.js";

const DEFAULT_STATES = ["waiting", "active", "failed", "delayed"];

function normalizeStates(rawStates) {
  if (!rawStates) return DEFAULT_STATES;
  const states = String(rawStates)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return states.length ? states : DEFAULT_STATES;
}

function serializeJob(job) {
  return {
    id: job.id,
    data: job.data,
    failedReason: job.failedReason || null,
    attemptsMade: job.attemptsMade || 0,
    timestamp: job.timestamp,
    stack: job.stacktrace || [],
  };
}

export async function listDLQ(req, res) {
  try {
    const states = normalizeStates(req.query?.states);
    const limit = Math.min(Number(req.query?.limit) || 200, 500);
    const jobs = await getDlqJobs(states, 0, Math.max(0, limit - 1));
    res.json(jobs.map(serializeJob));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDLQItem(req, res) {
  try {
    const job = await getDlqJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    res.json(serializeJob(job));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateDLQItem(req, res) {
  try {
    const job = await getDlqJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    const newData = req.body?.data;
    if (newData === undefined) {
      return res.status(422).json({ error: "data is required" });
    }
    await job.update(newData);
    await Audit.create({
      actor: req.user?._id,
      action: "dlq_edit",
      details: { jobId: String(job.id) },
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function retryDLQItem(req, res) {
  try {
    const job = await getDlqJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    const replayMeta = await replayDlqJob(job, {
      overrideData: req.body?.data,
      actorId: req.user?._id,
      correlationId: req.correlationId || req.headers["x-correlation-id"],
      replayMode: req.body?.data !== undefined ? "manual_edit_retry" : "manual_retry",
    });
    await Audit.create({
      actor: req.user?._id,
      action: "dlq_retry_manual",
      details: { jobId: req.params.id, replayMeta },
      ip: req.ip,
    });
    res.json({ ok: true, replayMeta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function editAndRetry(req, res) {
  req.body = { ...(req.body || {}), data: req.body?.newData };
  return retryDLQItem(req, res);
}

export async function updateRetryPolicy(req, res) {
  try {
    const id = req.params.connectorId;
    const { attempts, backoffDelay, backoffType } = req.body;
    const c = await Connector.findById(id);
    if (!c) return res.status(404).json({ error: "connector not found" });

    c.retryPolicy = {
      attempts: attempts || c.retryPolicy?.attempts || 5,
      backoffDelay: backoffDelay || c.retryPolicy?.backoffDelay || 1000,
      backoffType: backoffType || c.retryPolicy?.backoffType || "exponential",
    };

    await c.save();
    await Audit.create({
      actor: req.user?._id,
      action: "connector_retry_policy_updated",
      details: { connector: id, retryPolicy: c.retryPolicy },
      ip: req.ip,
    });
    res.json({ ok: true, retryPolicy: c.retryPolicy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
