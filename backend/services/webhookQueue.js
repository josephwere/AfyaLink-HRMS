import Queue from 'bull';
const REDIS = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const webhookQueue = new Queue('webhook-queue', REDIS, { defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 } });

// Example processor may be registered in workers
export default { webhookQueue };
