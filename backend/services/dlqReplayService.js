import { integrationDLQ, integrationQueue } from "./integrationQueue.js";

function normalizeReplayPayload(job, overrideData) {
  if (overrideData !== undefined) return overrideData;
  const data = job?.data;
  if (!data) return {};
  if (data.originalJob !== undefined) return data.originalJob;
  return data;
}

function withReplayMetadata(payload, metadata) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...payload,
      _dlqReplay: metadata,
    };
  }

  return {
    payload,
    _dlqReplay: metadata,
  };
}

export async function replayDlqJob(job, options = {}) {
  const payload = normalizeReplayPayload(job, options.overrideData);
  const replayMeta = {
    replayedFromJobId: String(job.id),
    replayedAt: new Date().toISOString(),
    replayMode: options.replayMode || "manual",
  };

  if (options.actorId) replayMeta.actorId = String(options.actorId);
  if (options.correlationId) replayMeta.correlationId = String(options.correlationId);

  const jobData = withReplayMetadata(payload, replayMeta);

  await integrationQueue.add(jobData);
  await job.remove();
  return replayMeta;
}

export async function getDlqJobs(states, start = 0, end = 199) {
  return integrationDLQ.getJobs(states, start, end);
}

export async function getDlqJobById(id) {
  return integrationDLQ.getJob(id);
}
