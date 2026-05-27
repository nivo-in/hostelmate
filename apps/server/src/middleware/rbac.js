import logger from '../config/logger.js'

export const requireRole = (roles) => {
  return (req, res, next) => {
    logger.info(`RBAC Check: expected ${roles}, actual ${req.profile?.role}`);
    if (!req.profile || !roles.includes(req.profile.role)) {
      logger.info('RBAC FAILED - returning 403');
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    next()
  }
}

export const requireStudent = requireRole(['student'])
export const requireWarden = requireRole(['warden', 'admin', 'staff'])
export const requireParent = requireRole(['parent'])
export const requireStaff = requireRole(['warden', 'admin', 'staff'])
