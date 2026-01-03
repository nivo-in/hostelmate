export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    next()
  }
}

export const requireStudent = requireRole(['student'])
export const requireWarden = requireRole(['warden'])
export const requireParent = requireRole(['parent'])
export const requireStaff = requireRole(['warden', 'admin'])
