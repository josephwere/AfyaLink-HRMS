import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || "";
const isTestEnv = process.env.NODE_ENV === "test";
const redisHost = REDIS_URL || "redis://127.0.0.1:6379";

function createQueue(name, options = {}) {
  if (isTestEnv && !REDIS_URL) {
    return {
      name,
      add: async () => null,
      process: () => {},
      on: () => {},
      close: async () => {},
      remove: async () => {},
    };
  }

  return new Queue(name, redisHost, options);
}

// Main integration queue with retries + exponential backoff
export const integrationQueue = createQueue('integration-queue', {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Dead-letter queue (DLQ)
export const integrationDLQ = createQueue('integration-dlq', {
  defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
});

if (!isTestEnv || REDIS_URL) {
  integrationQueue.on('failed', async (job, err) => {
    try {
      const maxAttempts = job.opts.attempts || 5;

      if (job.attemptsMade >= maxAttempts) {
        await integrationDLQ.add({
          originalJob: job.data,
          failedReason: err.message,
          stack: err.stack,
        });

        await job.remove();
        console.error('Job moved to DLQ:', job.id, err.message);
      }
    } catch (e) {
      console.error('Error moving job to DLQ:', e);
    }
  });
}

export default {
  integrationQueue,
  integrationDLQ,
};
