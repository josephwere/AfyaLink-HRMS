import Queue from 'bull';

const REDIS = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Main integration queue with retries + exponential backoff
export const integrationQueue = new Queue('integration-queue', REDIS, {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Dead-letter queue (DLQ)
export const integrationDLQ = new Queue('integration-dlq', REDIS, {
  defaultJobOptions: { removeOnComplete: true, removeOnFail: false }
});

// When job fails too many times → move to DLQ
integrationQueue.on('failed', async (job, err) => {
  try {
    const maxAttempts = job.opts.attempts || 5;

    if (job.attemptsMade >= maxAttempts) {
      await integrationDLQ.add({
        originalJob: job.data,
        failedReason: err.message,
        stack: err.stack
      });

      await job.remove();
      console.error('Job moved to DLQ:', job.id, err.message);
    }
  } catch (e) {
    console.error('Error moving job to DLQ:', e);
  }
});

export default {
  integrationQueue,
  integrationDLQ
};
