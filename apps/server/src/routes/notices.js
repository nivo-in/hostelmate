import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'

const router = Router()

router.post('/', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { title, content, target_audience } = req.body

    const allowedAudiences = ['students', 'parents', 'all']
    if (!target_audience || !allowedAudiences.includes(target_audience)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing target_audience' })
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'title and content are required' })
    }

    const { data: record, error } = await supabaseAdmin
      .from('notices')
      .insert({
        author_id: req.user.id,
        title,
        content,
        target_audience
      })
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data: record })
  } catch (error) {
    next(error)
  }
})

router.get('/', authenticate, async (req, res, next) => {
  try {
    const role = req.profile.role

    let query = supabaseAdmin
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (role === 'student') {
      query = query.in('target_audience', ['students', 'all'])
    } else if (role === 'parent') {
      query = query.in('target_audience', ['parents', 'all'])
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
