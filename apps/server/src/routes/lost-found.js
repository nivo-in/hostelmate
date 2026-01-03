import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent } from '../middleware/rbac.js'

const router = Router()

router.post('/', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { type, title, description, location } = req.body

    const allowedTypes = ['lost', 'found']
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be lost or found' })
    }

    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'title and description are required' })
    }

    const { data: record, error } = await supabaseAdmin
      .from('lost_and_found')
      .insert({
        reporter_id: req.user.id,
        type,
        title,
        description,
        location,
        status: 'open'
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
    const { status } = req.query

    let query = supabaseAdmin
      .from('lost_and_found')
      .select(`
        *,
        reporter:reporter_id (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/claim', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('lost_and_found')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
