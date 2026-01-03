import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'

const router = Router()

router.post('/', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { category, title, description } = req.body

    const allowedCategories = ['electrical', 'plumbing', 'furniture', 'cleaning', 'other']
    if (!category || !allowedCategories.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing category' })
    }

    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'title and description are required' })
    }

    const { data: record, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        student_id: req.user.id,
        category,
        title,
        description,
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

router.get('/my', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/all', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { status } = req.query

    let query = supabaseAdmin
      .from('complaints')
      .select(`
        *,
        student:student_id (
          id,
          roll_number,
          profile:id (
            full_name
          )
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

router.patch('/:id/status', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' })
    }

    const updates = { status }
    
    if (status === 'resolved') {
      updates.resolved_by = req.user.id
      updates.resolution_date = new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update(updates)
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
