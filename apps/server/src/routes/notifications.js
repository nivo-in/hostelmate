import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const unread_count = notifications.filter(n => !n.is_read).length

    res.json({ success: true, data: { notifications, unread_count } })
  } catch (error) {
    next(error)
  }
})

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
