import rateLimit from 'express-rate-limit'

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
