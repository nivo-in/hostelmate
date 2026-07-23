/**
 * @file apps/server/src/middleware/rbac.js
 * Express middleware for rbac request preprocessing and validation.
 */

import logger from '../config/logger.js';

/**
 * Express middleware factory to restrict access to route handlers
 * by requiring one or more specific roles in the user profile.
 *
 * @param {string[]} roles - Array of allowed role names (e.g. ['student', 'warden'])
 * @returns {import('express').RequestHandler}
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    logger.info(`RBAC Check: expected ${roles}, actual ${req.profile?.role}`);
    if (!req.profile || !roles.includes(req.profile.role)) {
      logger.info('RBAC FAILED - returning 403');
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  };
};

export const requireStudent = requireRole(['student']);
export const requireWarden = requireRole(['warden', 'admin', 'staff']);
export const requireParent = requireRole(['parent']);
export const requireStaff = requireRole(['warden', 'admin', 'staff']);
