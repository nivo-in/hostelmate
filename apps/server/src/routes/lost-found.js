import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { lostFoundSchema } from '../config/validation.js'
import logger from '../config/logger.js'

const router = Router()

router.post('/', authenticate, requireStudent, validate(lostFoundSchema), async (req, res, next) => {
  try {
    const { item_name, description, status, location_found } = req.body

    const { data: record, error } = await supabaseAdmin
  .from('lost_and_found')
  .insert({
    reported_by: req.user.id,
    item_name,
    description,
    location_found,
    status: status || 'lost',
    date_reported: new Date().toISOString().split('T')[0]
  })
      .select()
      .single()

    if (error) throw error

    logger.info(`Lost/found item "${item_name}" reported by ${req.user.id}`)
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
    students!lost_and_found_reported_by_fkey (
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

    logger.info(`Lost/found item ${id} claimed/resolved by ${req.user.id}`)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
