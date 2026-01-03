export const requireStudent = (req, res, next) => {
  if (req.profile?.role !== 'student') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
}

export const requireWarden = (req, res, next) => {
  if (req.profile?.role !== 'warden') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
}

export const requireParent = (req, res, next) => {
  if (req.profile?.role !== 'parent') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
}

export const requireStaff = (req, res, next) => {
  const role = req.profile?.role
  if (role !== 'warden' && role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
}
