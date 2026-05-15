/**
 * @file apps/server/src/middleware/rateLimit.js
 * Express middleware for rateLimit request preprocessing and validation.
 */

import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * General API rate limiter applied to all routes.
 * Production: 100 requests per 15 minutes per IP.
 * Development: 2000 requests per 15 minutes (permissive for hot-reload).
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  validate: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded: ${req.ip} ${req.method} ${req.url}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
  },
});

/**
 * Strict auth limiter applied to login/register routes.
 * Production: 10 requests per 15 minutes per IP (brute-force protection).
 * Development: 200 requests per 15 minutes.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * Notification limiter applied to notification read/update endpoints.
 * Keyed by IP + user ID to allow parallel sessions.
 * Production: 30 requests per 2 minutes per user.
 * Development: 100 requests per 2 minutes.
 */
export const notificationLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: isDev ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => `${req.ip}_${req.user?.id || 'anon'}`,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: 'Too many notification requests.' });
  },
});
