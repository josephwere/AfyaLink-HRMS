import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || '';
let redis = null;
if(REDIS_URL) redis = new Redis(REDIS_URL);

const mem = new Map();

export async function setOtp(key, code, ttl=300){
  if(redis) return redis.setex(`otp:${key}`, ttl, code);
  mem.set(key, { code, exp: Date.now()+ttl*1000 });
}
export async function getOtp(key){
  if(redis) return redis.get(`otp:${key}`);
  const v = mem.get(key);
  if(!v) return null;
  if(Date.now()>v.exp){ mem.delete(key); return null; }
  return v.code;
}
export async function delOtp(key){
  if(redis) return redis.del(`otp:${key}`);
  mem.delete(key);
}
export default { setOtp, getOtp, delOtp };
