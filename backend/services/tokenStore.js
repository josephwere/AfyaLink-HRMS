import Redis from 'ioredis';

let redis = null;
const REDIS_URL = process.env.REDIS_URL || '';
if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
}

const memory = { refreshByUser: {}, revoked: new Set() };

export async function addRefreshToken(userId, token) {
  if (redis) return redis.sadd(`refresh:${userId}`, token);
  memory.refreshByUser[userId] = memory.refreshByUser[userId] || new Set();
  memory.refreshByUser[userId].add(token);
}
export async function removeRefreshToken(userId, token) {
  if (redis) return redis.srem(`refresh:${userId}`, token);
  const s = memory.refreshByUser[userId]; if (s) s.delete(token);
}
export async function hasRefreshToken(userId, token) {
  if (redis) return (await redis.sismember(`refresh:${userId}`, token)) === 1;
  const s = memory.refreshByUser[userId]; return !!(s && s.has(token));
}
export async function revokeRefreshToken(token) {
  if (redis) return redis.set(`revoked:${token}`, '1', 'EX', 7*24*60*60);
  memory.revoked.add(token);
}
export async function isRevoked(token) {
  if (redis) return !!(await redis.get(`revoked:${token}`));
  return memory.revoked.has(token);
}

export default { addRefreshToken, removeRefreshToken, hasRefreshToken, revokeRefreshToken, isRevoked };
