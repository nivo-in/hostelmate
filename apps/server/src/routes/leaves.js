import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'

const router = Router()

router.post('/', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { start_date, end_date, reason } = req.body

    if (!start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, error: 'start_date, end_date, and reason are required' })
    }

    const today = new Date().toISOString().split('T')[0]
    
    if (start_date < today) {
      return res.status(400).json({ success: false, error: 'start_date cannot be in the past' })
    }

    if (end_date < start_date) {
      return res.status(400).json({ success: false, error: 'end_date must be after or equal to start_date' })
    }

    const { data: record, error } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        student_id: req.user.id,
        start_date,
        end_date,
        reason,
        status: 'pending'
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
      .from('leave_requests')
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
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
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

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/approve', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/reject', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: 'rejected' })
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
