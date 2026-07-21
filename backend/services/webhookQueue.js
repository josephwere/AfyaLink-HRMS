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
    };
  }

  return new Queue(name, redisHost, options);
}

export const webhookQueue = createQueue('webhook-queue', {
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
});

export default { webhookQueue };
