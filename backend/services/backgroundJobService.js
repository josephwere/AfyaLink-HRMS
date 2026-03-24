import BackgroundJob from "../models/BackgroundJob.js";

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_");
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildErrorPayload(error) {
  return {
    message: String(error?.message || "Job failed"),
    code: String(error?.code || ""),
    stack: String(error?.stack || "").slice(0, 8000),
    at: new Date(),
  };
}

function nextRetryAt(job) {
  const baseDelay = parsePositiveNumber(job?.backoffMs, 60000);
  const attempts = Math.max(0, Number(job?.attemptsMade || 0) - 1);
  const delay = Math.min(baseDelay * 2 ** attempts, 6 * 60 * 60 * 1000);
  return new Date(Date.now() + delay);
}

export async function enqueueBackgroundJob({
  type,
  queue = "default",
  payload = {},
  priority = 50,
  source = "",
  dedupeKey = "",
  tags = [],
  runAt = new Date(),
  maxAttempts = 5,
  backoffMs = 60000,
  hospital = null,
  user = null,
  metadata = {},
}) {
  const normalizedType = normalizeType(type);
  if (!normalizedType) {
    throw new Error("Background job type is required");
  }

  const normalizedDedupeKey = String(dedupeKey || "").trim();
  if (normalizedDedupeKey) {
    const existing = await BackgroundJob.findOne({
      dedupeKey: normalizedDedupeKey,
      status: { $in: ["QUEUED", "RUNNING"] },
    });
    if (existing) return existing;
  }

  return BackgroundJob.create({
    type: normalizedType,
    queue: String(queue || "default").trim() || "default",
    payload,
    priority: parsePositiveNumber(priority, 50),
    source: String(source || "").trim(),
    dedupeKey: normalizedDedupeKey,
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    runAt: runAt ? new Date(runAt) : new Date(),
    maxAttempts: parsePositiveNumber(maxAttempts, 5),
    backoffMs: parsePositiveNumber(backoffMs, 60000),
    hospital,
    user,
    metadata,
  });
}

export async function claimNextBackgroundJob({
  workerId,
  supportedTypes = [],
  leaseMs = 120000,
}) {
  const now = new Date();
  const filter = {
    status: "QUEUED",
    runAt: { $lte: now },
    $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }],
  };
  if (supportedTypes.length) {
    filter.type = { $in: supportedTypes.map(normalizeType) };
  }

  return BackgroundJob.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: String(workerId || "worker"),
        leaseExpiresAt: new Date(now.getTime() + parsePositiveNumber(leaseMs, 120000)),
        startedAt: now,
      },
      $inc: { attemptsMade: 1 },
    },
    {
      sort: { priority: 1, runAt: 1, createdAt: 1 },
      new: true,
    }
  );
}

export async function completeBackgroundJob(jobId, result = null) {
  return BackgroundJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: "SUCCEEDED",
        result,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: "",
        leaseExpiresAt: null,
      },
    },
    { new: true }
  );
}

export async function failBackgroundJob(job, error) {
  if (!job?._id) return null;
  const lastError = buildErrorPayload(error);
  const maxAttempts = parsePositiveNumber(job.maxAttempts, 5);
  const attemptsMade = Number(job.attemptsMade || 0);

  if (attemptsMade >= maxAttempts) {
    return BackgroundJob.findByIdAndUpdate(
      job._id,
      {
        $set: {
          status: "DEAD_LETTER",
          finishedAt: new Date(),
          lockedAt: null,
          lockedBy: "",
          leaseExpiresAt: null,
          lastError,
        },
      },
      { new: true }
    );
  }

  return BackgroundJob.findByIdAndUpdate(
    job._id,
    {
      $set: {
        status: "QUEUED",
        runAt: nextRetryAt(job),
        lockedAt: null,
        lockedBy: "",
        leaseExpiresAt: null,
        lastError,
      },
    },
    { new: true }
  );
}

export async function requeueBackgroundJob(jobId) {
  return BackgroundJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: "QUEUED",
        runAt: new Date(),
        lockedAt: null,
        lockedBy: "",
        leaseExpiresAt: null,
        finishedAt: null,
      },
    },
    { new: true }
  );
}

export async function listBackgroundJobs({
  status = "",
  queue = "",
  limit = 50,
}) {
  const where = {};
  if (status) where.status = String(status).trim().toUpperCase();
  if (queue) where.queue = String(queue).trim();

  return BackgroundJob.find(where)
    .sort({ createdAt: -1 })
    .limit(Math.min(parsePositiveNumber(limit, 50), 200))
    .lean();
}

export async function getBackgroundJobSummary() {
  const [statusCounts, typeCounts] = await Promise.all([
    BackgroundJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    BackgroundJob.aggregate([
      {
        $group: {
          _id: "$type",
          queued: {
            $sum: {
              $cond: [{ $eq: ["$status", "QUEUED"] }, 1, 0],
            },
          },
          running: {
            $sum: {
              $cond: [{ $eq: ["$status", "RUNNING"] }, 1, 0],
            },
          },
          deadLetter: {
            $sum: {
              $cond: [{ $eq: ["$status", "DEAD_LETTER"] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1, _id: 1 } },
    ]),
  ]);

  const byStatus = statusCounts.reduce((acc, row) => {
    acc[row._id || "UNKNOWN"] = row.count || 0;
    return acc;
  }, {});

  return {
    byStatus,
    byType: typeCounts.map((row) => ({
      type: row._id || "UNKNOWN",
      queued: row.queued || 0,
      running: row.running || 0,
      deadLetter: row.deadLetter || 0,
      total: row.total || 0,
    })),
  };
}
