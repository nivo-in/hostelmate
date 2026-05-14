import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { complaintSchema } from '../config/validation.js'
import logger from '../config/logger.js'
import { deleteCache } from '../config/redis.js'
import { createNotification } from '../config/notify.js'
import { auditLog } from '../config/audit.js'

const router = Router()

router.post('/', authenticate, requireStudent, validate(complaintSchema), async (req, res, next) => {
  try {
    const { category, description, is_urgent } = req.body

    const { data: record, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        student_id: req.user.id,
        category,
        description,
        is_urgent: is_urgent || false,
        status: 'open'
      })
      .select()
      .single()

    if (error) throw error

    logger.info(`Complaint submitted by user ${req.user.id}`)
    await deleteCache('stats:dashboard')
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
    students!complaints_student_id_fkey (
      roll_number,
      profiles!students_id_fkey (
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

    logger.info(`Complaint ${id} status updated to ${status} by ${req.user.id}`)
    await auditLog(req.user.id, 'update_complaint', 'complaint', id)
    
    if (status === 'resolved') {
      await createNotification(data.student_id, 'Complaint Resolved', 'Your complaint has been resolved', 'complaint', id)
    }
    
    await deleteCache('stats:dashboard')
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
