import rateLimit from 'express-rate-limit';

export const revealLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 6, // limit to 6 attempts per minute per IP
  message: { error: 'Too many attempts, slow down' },
  standardHeaders: true,
  legacyHeaders: false
});

export default revealLimiter;
