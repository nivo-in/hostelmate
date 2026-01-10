import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'

const router = Router()

router.get('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { resource, action, limit = 50 } = req.query

    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        *,
        profiles!audit_logs_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (resource) {
      query = query.eq('resource', resource)
    }
    
    if (action) {
      query = query.eq('action', action)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
