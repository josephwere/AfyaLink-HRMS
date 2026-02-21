import Bull from 'bull';
const REDIS = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const notificationQueue = new Bull('notifications', REDIS, { defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 } });

export default { notificationQueue };
