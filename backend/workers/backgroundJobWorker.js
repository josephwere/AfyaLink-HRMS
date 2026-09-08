import {
  claimNextBackgroundJob,
  completeBackgroundJob,
  failBackgroundJob,
} from "../services/backgroundJobService.js";
import { syncBrevoContactForUser } from "../services/brevoContacts.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS } from "../services/notificationService.js";
import { integrationQueue } from "../services/integrationQueue.js";
import { webhookQueue } from "../services/webhookQueue.js";
import { setMetricGauge, incrementMetricCounter } from "../utils/metrics.js";

const workerId = `bg-${process.pid}`;
const pollIntervalMs = Number(process.env.BACKGROUND_JOB_POLL_MS || 5000);
const concurrency = Math.max(1, Number(process.env.BACKGROUND_JOB_CONCURRENCY || 2));
const supportedTypes = [
  "BREVO_CONTACT_SYNC",
  "EMAIL_DELIVERY",
  "SMS_DELIVERY",
  "INTEGRATION_RETRY",
  "WEBHOOK_DELIVERY",
];

let started = false;
let activeWorkers = 0;
let lastHeartbeatAt = 0;

async function processJob(job) {
  const payload = job?.payload || {};

  switch (job.type) {
    case "BREVO_CONTACT_SYNC":
      return syncBrevoContactForUser(payload.user, payload.options || {});
    case "EMAIL_DELIVERY":
      return sendEmail(payload);
    case "SMS_DELIVERY":
      return sendSMS(payload);
    case "INTEGRATION_RETRY":
      await integrationQueue.add(payload.jobData || {}, payload.options || {});
      return { queued: true, provider: "integrationQueue" };
    case "WEBHOOK_DELIVERY":
      await webhookQueue.add(payload.jobData || {}, payload.options || {});
      return { queued: true, provider: "webhookQueue" };
    default:
      throw new Error(`Unsupported background job type: ${job.type}`);
  }
}

async function tick() {
  if (activeWorkers >= concurrency) return;

  activeWorkers += 1;
  lastHeartbeatAt = Date.now();
  setMetricGauge("afyalink_background_worker_heartbeat", 1, { worker: workerId }, "Whether the background job worker has recently executed.");
  try {
    const job = await claimNextBackgroundJob({
      workerId,
      supportedTypes,
    });
    if (!job) return;

    try {
      const result = await processJob(job);
      await completeBackgroundJob(job._id, result);
    } catch (error) {
      await failBackgroundJob(job, error);
      incrementMetricCounter("afyalink_background_jobs_failed_total", { type: job.type }, 1, "Background jobs that failed processing.");
    }
  } finally {
    activeWorkers = Math.max(0, activeWorkers - 1);
  }
}

export function startBackgroundJobWorker() {
  if (started || process.env.DISABLE_BACKGROUND_JOBS === "1") return;
  started = true;
  lastHeartbeatAt = Date.now();
  setMetricGauge("afyalink_background_worker_heartbeat", 1, { worker: workerId }, "Whether the background job worker has recently executed.");
  setInterval(() => {
    for (let index = 0; index < concurrency; index += 1) {
      tick().catch((error) => {
        console.error("[BACKGROUND_JOB_WORKER] tick failed", error);
      });
    }
  }, pollIntervalMs).unref?.();
}

export function getBackgroundJobWorkerHealth() {
  const heartbeatWindowMs = Math.max(Number(process.env.BACKGROUND_JOB_HEARTBEAT_WINDOW_MS || 30000), pollIntervalMs * 3);
  return { started, activeWorkers, lastHeartbeatAt, healthy: !started || (lastHeartbeatAt > 0 && Date.now() - lastHeartbeatAt <= heartbeatWindowMs) };
}

startBackgroundJobWorker();
