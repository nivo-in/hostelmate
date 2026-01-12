import rateLimit from 'express-rate-limit'
import logger from '../config/logger.js'

const isDev = process.env.NODE_ENV !== 'production'

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded: ${req.ip} ${req.method} ${req.url}`)
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    })
  }
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded: ${req.ip}`)
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in 15 minutes.'
    })
  }
})

export const notificationLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: isDev ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}_${req.user?.id || 'anon'}`,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: 'Too many notification requests.' })
  }
})
