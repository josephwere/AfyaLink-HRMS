import rateLimit from 'express-rate-limit';
export const revealLimiter = rateLimit({
  windowMs: 5*60*1000, // 5 minutes
  max: 5, // max 5 attempts per window per IP
  message: { error: 'Too many reveal attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
